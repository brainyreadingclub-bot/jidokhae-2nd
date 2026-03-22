/**
 * KST (Korea Standard Time) date utilities.
 * Used across M3-M5 for all date calculations.
 * Pure functions — no Next.js or Supabase imports.
 */

/** Returns today's date as "YYYY-MM-DD" in KST */
export function getKSTToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/** Returns tomorrow's date as "YYYY-MM-DD" in KST */
export function getTomorrowKST(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(Date.now() + 24 * 60 * 60 * 1000))
}

/** Converts any Date to "YYYY-MM-DD" in KST */
export function toKSTDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/** "2026-03-10" → "3월 10일 (화)" */
export function formatKoreanDate(dateStr: string): string {
  const [, month, day] = dateStr.split('-').map(Number)
  const date = new Date(`${dateStr}T12:00:00+09:00`)
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return `${month}월 ${day}일 (${days[date.getUTCDay()]})`
}

/** "19:00:00" or "19:00" → "오후 7:00" */
export function formatKoreanTime(time: string): string {
  if (!time) return ''
  const parts = time.split(':')
  const hourStr = parts[0] ?? '0'
  const minuteStr = (parts[1] ?? '00').padStart(2, '0')
  const hour = parseInt(hourStr, 10)
  if (isNaN(hour)) return ''
  const period = hour < 12 ? '오전' : '오후'
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return `${period} ${displayHour}:${minuteStr}`
}

/** "10000" → "10,000" */
export function formatFee(fee: number): string {
  return fee.toLocaleString('ko-KR')
}

export type MeetingTiming = 'before_or_today' | 'after'

/** Determines if a meeting is upcoming or past based on KST dates */
export function getMeetingTiming(
  meetingDate: string,
  kstToday: string,
): MeetingTiming {
  return meetingDate >= kstToday ? 'before_or_today' : 'after'
}

export type ButtonState =
  | { type: 'register' }
  | { type: 'full' }
  | { type: 'cancel' }
  | { type: 'attended' }
  | { type: 'none' }
  | { type: 'join_waitlist' }
  | { type: 'waitlist_cancel' }

/** Computes the action button state for a meeting detail page (PRD §6-2 + Phase 2-2 대기) */
export function getButtonState(
  meetingDate: string,
  kstToday: string,
  hasConfirmed: boolean,
  isFull: boolean,
  hasWaitlisted: boolean = false,
): ButtonState {
  const timing = getMeetingTiming(meetingDate, kstToday)

  if (timing === 'before_or_today') {
    if (hasConfirmed) return { type: 'cancel' }
    if (hasWaitlisted) return { type: 'waitlist_cancel' }
    if (isFull) return { type: 'join_waitlist' }
    return { type: 'register' }
  }

  // after meeting
  if (hasConfirmed) return { type: 'attended' }
  return { type: 'none' }
}
