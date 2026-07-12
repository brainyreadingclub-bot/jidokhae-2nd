import { getDaysUntil } from '@/lib/kst'

/** 물어보기 대상 모임의 최근 윈도우(일). 과거 소급 스팸 방지 — "앞으로의 정기모임만"의 실용 근사 */
export const ASK_WINDOW_DAYS = 60

type EligibleMeetingShape = {
  date: string
  meeting_type: string
  status: string
}

/**
 * 물어보기(및 분모) 대상 정기모임인지 순수 판정.
 * 정기 + active + 과거 + 최근 windowDays 이내.
 */
export function isAskEligibleMeeting(
  meeting: EligibleMeetingShape,
  kstToday: string,
  windowDays = ASK_WINDOW_DAYS,
): boolean {
  if (meeting.meeting_type !== 'regular') return false
  if (meeting.status !== 'active') return false
  const days = getDaysUntil(meeting.date, kstToday) // 과거면 음수
  return days < 0 && days >= -windowDays
}

/** "2026-07-11" → "7월 정기모임에서". null/빈 값은 null */
export function askSourceLabel(date: string | null | undefined): string | null {
  if (!date) return null
  const month = Number(date.slice(5, 7))
  if (!month) return null
  return `${month}월 정기모임에서`
}
