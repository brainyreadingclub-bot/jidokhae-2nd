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

type NotificationType = 'meeting_remind' | 'registration_confirm'

type SendNotificationParams = {
  type: NotificationType
  recipientId: string
  recipientPhone: string | null
  meetingId: string
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
      meeting_id: params.meetingId,
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
      meeting_id: params.meetingId,
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
      '#{결제금액}': formatFee((meeting as Meeting).fee),
    },
  })
}
