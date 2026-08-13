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
import type { Meeting } from '@/types/meeting'
// 알림 종류는 types/notification.ts가 유일한 정의다. 여기 따로 적어두면
// 종류가 늘 때 한쪽만 갱신돼 어긋난다 (실제로 그랬다).
import type { NotificationType } from '@/types/notification'

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

  const { data: registration } = await supabase
    .from('registrations')
    .select('paid_amount')
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
      '#{결제금액}': formatFee(refundedAmount),
    },
  })
}

// ─── 물어보기 (모임에서 읽은 책 담기) 알림 ───

/**
 * 모임 다음날, 참여자에게 "읽으신 책 담아보세요"를 1회 보낸다.
 *
 * 중복 차단은 notifications의 부분 UNIQUE INDEX가 맡는다
 * (recipient_id, meeting_id) WHERE type = 'book_ask'.
 * INSERT 단계에서 23505로 걸리므로 Solapi 발송 전에 차단된다.
 *
 * registrationId를 넘기지 않는 이유 — 이 알림은 "신청 건"이 아니라
 * "그 모임에 참여한 사람"에게 가는 것이라 회원+모임이 단위다.
 */
export async function sendBookAskNotification(
  userId: string,
  meetingId: string,
  meetingDate: string,
) {
  const profile = await getProfileForNotification(userId)
  const displayName = profile.real_name || profile.nickname

  return sendNotification({
    type: 'book_ask',
    recipientId: userId,
    recipientPhone: profile.phone,
    meetingId,
    templateCode: process.env.SOLAPI_TEMPLATE_BOOK_ASK!,
    variables: {
      '#{회원명}': displayName,
      '#{모임일}': formatKoreanDate(meetingDate),
    },
  })
}

// ─── 가입 환영 알림 ───

/**
 * 프로필 설정을 처음 마친 회원에게 환영 인사를 1회 보낸다.
 *
 * 왜 가입 시점이 아니라 프로필 설정 시점인가 —
 * 알림톡은 전화번호가 있어야 나가는데, 카카오 로그인 직후에는 번호를 모른다.
 * 번호를 처음 알게 되는 순간이 프로필 설정 완료이고, 그래서 발송 시점이
 * 사실상 여기 하나뿐이다.
 *
 * 모임 정보를 넣지 않는다 — 가입 시점과 첫 모임 사이가 비면 틀린 말이 된다
 * (검토문서/2026-08-11 §6).
 *
 * 중복 차단은 notifications의 부분 UNIQUE INDEX가 맡는다
 * (recipient_id) WHERE type = 'new_member_welcome'.
 * 회원 1명당 평생 1회이므로 모임이 단위가 아니라 사람이 단위다.
 */
export async function sendNewMemberWelcomeNotification(userId: string) {
  const profile = await getProfileForNotification(userId)
  const displayName = profile.real_name || profile.nickname

  return sendNotification({
    type: 'new_member_welcome',
    recipientId: userId,
    recipientPhone: profile.phone,
    meetingId: null,
    templateCode: process.env.SOLAPI_TEMPLATE_WELCOME!,
    variables: {
      '#{회원명}': displayName,
    },
  })
}
