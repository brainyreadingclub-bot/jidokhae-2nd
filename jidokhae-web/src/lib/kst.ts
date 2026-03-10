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
  const [hourStr, minuteStr] = time.split(':')
  const hour = parseInt(hourStr, 10)
  const minute = minuteStr.padStart(2, '0')
  const period = hour < 12 ? '오전' : '오후'
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return `${period} ${displayHour}:${minute}`
}

/** "10000" → "10,000원" */
export function formatFee(fee: number): string {
  return `${fee.toLocaleString('ko-KR')}원`
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

/** Computes the action button state for a meeting detail page (PRD §6-2) */
export function getButtonState(
  meetingDate: string,
  kstToday: string,
  hasConfirmed: boolean,
  isFull: boolean,
): ButtonState {
  const timing = getMeetingTiming(meetingDate, kstToday)

  if (timing === 'before_or_today') {
    if (hasConfirmed) return { type: 'cancel' }
    if (isFull) return { type: 'full' }
    return { type: 'register' }
  }

  // after meeting
  if (hasConfirmed) return { type: 'attended' }
  return { type: 'none' }
}
