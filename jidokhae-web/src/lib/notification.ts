/**
 * 알림톡 발송 + notifications 테이블 이력 기록.
 * 모든 DB 접근은 service_role (쿠키 불필요).
 *
 * 중복 방지 패턴: INSERT(pending) 먼저 → Solapi 발송 → UPDATE(sent/failed).
 * UNIQUE INDEX 위반은 INSERT 단계에서 발생하여 Solapi 발송 전에 차단됨.
 */

import { sendAlimtalk } from '@/lib/solapi'
import { createServiceClient } from '@/lib/supabase/admin'
import { formatKoreanDate, formatKoreanTime, formatFee } from '@/lib/kst'
import { paymentStatusLabel } from '@/lib/registration-status'
import type { Meeting } from '@/types/meeting'

type NotificationType =
  | 'meeting_remind'
  | 'registration_confirm'
  | 'waitlist_confirm'
  | 'waitlist_promoted'
  | 'waitlist_refunded'

type SendNotificationParams = {
  type: NotificationType
  recipientId: string
  recipientPhone: string | null
  /** 모임 연결. 연결할 모임이 없으면 null(빈 문자열 금지 — uuid 컬럼) */
  meetingId: string | null
  registrationId?: string
  templateCode: string
  variables: Record<string, string>
}

type ProfileForNotification = {
  phone: string | null
  real_name: string | null
  nickname: string
}

// ─── Profile 조회 (service_role) ───

export async function getProfileForNotification(userId: string): Promise<ProfileForNotification> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('profiles')
    .select('phone, real_name, nickname')
    .eq('id', userId)
    .single()
  return data ?? { phone: null, real_name: null, nickname: '' }
}

// ─── 알림 발송 + 이력 기록 ───

export async function sendNotification(params: SendNotificationParams) {
  const supabase = createServiceClient()

  // 전화번호 없으면 skip
  if (!params.recipientPhone) {
    await supabase.from('notifications').insert({
      type: params.type,
      recipient_id: params.recipientId,
      recipient_phone: '',
      // 빈 문자열은 uuid 캐스팅이 깨져 INSERT 자체가 실패한다(22P02) — null로 정규화.
      // 실제 사고: sendWaitlistRefundedNotification이 ''를 넘겨 미승격 환불 알림이
      // 한 번도 발송되지 않고 이력 행조차 남지 않았다(2026-07-30 발견).
      meeting_id: params.meetingId || null,
      registration_id: params.registrationId ?? null,
      template_code: params.templateCode,
      status: 'skipped',
      error_message: '전화번호 없음',
    })
    return { status: 'skipped' as const }
  }

  // Step 1: INSERT pending — UNIQUE INDEX 위반 시 여기서 에러 → 중복 발송 차단
  const { data: notification, error: insertError } = await supabase
    .from('notifications')
    .insert({
      type: params.type,
      recipient_id: params.recipientId,
      recipient_phone: params.recipientPhone,
      // 빈 문자열은 uuid 캐스팅이 깨져 INSERT 자체가 실패한다(22P02) — null로 정규화.
      // 실제 사고: sendWaitlistRefundedNotification이 ''를 넘겨 미승격 환불 알림이
      // 한 번도 발송되지 않고 이력 행조차 남지 않았다(2026-07-30 발견).
      meeting_id: params.meetingId || null,
      registration_id: params.registrationId ?? null,
      template_code: params.templateCode,
      status: 'pending',
    })
    .select('id')
    .single()

  if (insertError) {
    // UNIQUE 위반 (23505) = 이미 발송됨 → skip
    if (insertError.code === '23505') {
      return { status: 'skipped' as const }
    }
    console.error('[notification] INSERT 실패:', insertError)
    return { status: 'failed' as const, error: insertError.message }
  }

  // Step 2: Solapi 발송
  try {
    const result = await sendAlimtalk({
      to: params.recipientPhone,
      templateId: params.templateCode,
      variables: params.variables,
    })

    // Step 3: UPDATE → sent
    await supabase
      .from('notifications')
      .update({
        status: 'sent',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        solapi_message_id: (result as any)?.groupId ?? null,
        sent_at: new Date().toISOString(),
      })
      .eq('id', notification.id)

    return { status: 'sent' as const }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류'

    // Step 3: UPDATE → failed
    await supabase
      .from('notifications')
      .update({
        status: 'failed',
        error_message: errorMessage,
      })
      .eq('id', notification.id)

    return { status: 'failed' as const, error: errorMessage }
  }
}

// ─── 신청 완료 알림 (상위 래퍼) ───

export async function sendRegistrationConfirmNotification(
  meetingId: string,
  userId: string,
  registrationId: string,
) {
  const supabase = createServiceClient()

  // meeting 상세 조회 (title, date, time, location, fee)
  const { data: meeting } = await supabase
    .from('meetings')
    .select('title, date, time, location, fee')
    .eq('id', meetingId)
    .single()

  if (!meeting) return

  // registration 결제 금액 조회 (스텝 할인 시 paid_amount < fee)
  const { data: registration } = await supabase
    .from('registrations')
    .select('paid_amount')
    .eq('id', registrationId)
    .single()

  const paidAmount = registration?.paid_amount ?? (meeting as Meeting).fee

  const profile = await getProfileForNotification(userId)
  const displayName = profile.real_name || profile.nickname

  await sendNotification({
    type: 'registration_confirm',
    recipientId: userId,
    recipientPhone: profile.phone,
    meetingId,
    registrationId,
    templateCode: process.env.SOLAPI_TEMPLATE_CONFIRM!,
    variables: {
      '#{회원명}': displayName,
      '#{모임명}': (meeting as Meeting).title,
      '#{모임일시}': `${formatKoreanDate((meeting as Meeting).date)} ${formatKoreanTime((meeting as Meeting).time)}`,
      '#{장소}': (meeting as Meeting).location,
      '#{결제금액}': formatFee(paidAmount),
    },
  })
}

// ─── 대기 신청 완료 알림 ───

export async function sendWaitlistConfirmNotification(
  meetingId: string,
  userId: string,
  registrationId: string,
) {
  const supabase = createServiceClient()

  const { data: meeting } = await supabase
    .from('meetings')
    .select('title, date, time, location, fee')
    .eq('id', meetingId)
    .single()

  if (!meeting) return

  const { data: registration } = await supabase
    .from('registrations')
    .select('paid_amount')
    .eq('id', registrationId)
    .single()

  const paidAmount = registration?.paid_amount ?? (meeting as Meeting).fee

  const profile = await getProfileForNotification(userId)
  const displayName = profile.real_name || profile.nickname

  await sendNotification({
    type: 'waitlist_confirm',
    recipientId: userId,
    recipientPhone: profile.phone,
    meetingId,
    registrationId,
    templateCode: process.env.SOLAPI_TEMPLATE_WAITLIST_CONFIRM!,
    variables: {
      '#{회원명}': displayName,
      '#{모임명}': (meeting as Meeting).title,
      '#{모임일시}': `${formatKoreanDate((meeting as Meeting).date)} ${formatKoreanTime((meeting as Meeting).time)}`,
      '#{장소}': (meeting as Meeting).location,
      '#{결제금액}': formatFee(paidAmount),
    },
  })
}

// ─── 대기 승격 확정 알림 ───

export async function sendWaitlistPromotedNotification(
  meetingId: string,
  userId: string,
  registrationId: string,
) {
  const supabase = createServiceClient()

  const { data: meeting } = await supabase
    .from('meetings')
    .select('id, title, date, time, location, fee')
    .eq('id', meetingId)
    .single()

  if (!meeting) return

  // status도 함께 읽는다 — 계좌이체로 대기 신청한 회원은 승격 시 RPC가
  // `pending_transfer`로 분기시키므로 "결제완료"라고 단언하면 틀린 말이 된다
  // (promote_next_waitlisted, migration-bank-transfer-functions.sql).
  const { data: registration } = await supabase
    .from('registrations')
    .select('paid_amount, status')
    .eq('id', registrationId)
    .single()

  const paidAmount = registration?.paid_amount ?? (meeting as Meeting).fee

  const profile = await getProfileForNotification(userId)
  const displayName = profile.real_name || profile.nickname

  await sendNotification({
    type: 'waitlist_promoted',
    recipientId: userId,
    recipientPhone: profile.phone,
    meetingId,
    registrationId,
    templateCode: process.env.SOLAPI_TEMPLATE_WAITLIST_PROMOTED!,
    variables: {
      '#{회원명}': displayName,
      '#{모임명}': (meeting as Meeting).title,
      '#{모임일시}': `${formatKoreanDate((meeting as Meeting).date)} ${formatKoreanTime((meeting as Meeting).time)}`,
      '#{장소}': (meeting as Meeting).location,
      '#{결제금액}': formatFee(paidAmount),
      '#{결제상태}': paymentStatusLabel(registration?.status ?? 'confirmed'),
      '#{모임ID}': (meeting as Meeting).id,
    },
  })
}

// ─── 미승격 자동 환불 알림 ───

export async function sendWaitlistRefundedNotification(
  userId: string,
  registrationId: string,
  meetingId: string,
  meetingTitle: string,
  refundedAmount: number,
  meetingDate: string,
  meetingTime: string,
) {
  const profile = await getProfileForNotification(userId)
  const displayName = profile.real_name || profile.nickname

  await sendNotification({
    type: 'waitlist_refunded',
    recipientId: userId,
    recipientPhone: profile.phone,
    meetingId,
    registrationId,
    templateCode: process.env.SOLAPI_TEMPLATE_WAITLIST_REFUNDED!,
    variables: {
      '#{회원명}': displayName,
      '#{모임명}': meetingTitle,
      '#{모임일시}': `${formatKoreanDate(meetingDate)} ${formatKoreanTime(meetingTime)}`,
      '#{결제금액}': formatFee(refundedAmount),
    },
  })
}
