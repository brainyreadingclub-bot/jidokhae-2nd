import { createClient } from '@/lib/supabase/server'
import { getMeeting } from '@/lib/meeting'
import { PARTICIPATED_STATUSES } from '@/lib/registration-status'
import { buildCalendarEvent, type CalendarEvent } from '@/lib/calendar-event'

export type MyCalendarEvent = {
  event: CalendarEvent
  /** GA4 `calendar_add_click`·`channel_add_click`의 `payment_method` — 신청 행에 적힌 값 그대로 */
  paymentMethod: string
}

/**
 * 본인이 자리를 차지한 모임(confirmed·pending_transfer)일 때만 달력 일정을 만든다.
 *
 * 왜 신청을 확인하나 — 일정에 `detail_address`가 들어간다. 이 칸은 공개 모임 화면이 감추는
 * 민감 칸이다(`policy/meetings`). 신청하지 않은 사람·대기자(waitlisted, 확정 아님)에게는 null.
 * 조회는 anon 키 + RLS — 본인 신청 행만 읽힌다.
 */
export async function loadMyCalendarEvent(
  meetingId: string,
  userId: string,
): Promise<MyCalendarEvent | null> {
  const supabase = await createClient()
  const [meeting, regResult] = await Promise.all([
    getMeeting(meetingId),
    supabase
      .from('registrations')
      .select('payment_method')
      .eq('meeting_id', meetingId)
      .eq('user_id', userId)
      .in('status', PARTICIPATED_STATUSES)
      .order('created_at', { ascending: false })
      .limit(1),
  ])

  if (!meeting || meeting.status !== 'active') return null
  if (regResult.error || !regResult.data || regResult.data.length === 0) return null

  return {
    event: buildCalendarEvent(meeting),
    paymentMethod: (regResult.data[0] as { payment_method: string | null }).payment_method ?? 'unknown',
  }
}
