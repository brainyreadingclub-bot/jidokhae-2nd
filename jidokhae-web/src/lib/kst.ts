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

/**
 * 모임 참가비 표기. **0원 모임이면 "무료".**
 *
 * 왜 `formatFee`를 안 고치고 함수를 더 두는가 —
 *   - 운영자·정산 화면에서는 **0이 맞는 값**이다. 거기 "무료"가 뜨면 집계를 읽을 수 없다
 *   - 환불 금액에도 쓰지 않는다. 0은 "공짜"가 아니라 "돌려받을 돈이 없음"이고,
 *     그 자리는 이미 전용 문구로 처리돼 있다("환불 불가 기간입니다" 등)
 *
 * 배경: `fee = 0`인 무료 모임(대구)이 화면마다 참가비 "0"으로 떠서
 * 값을 못 불러온 것처럼 보였다 (2026-10-07).
 */
export function formatMeetingFee(fee: number): string {
  return formatPaidAmount(fee, fee)
}

/**
 * 결제 건(신청)의 금액 표기.
 *
 * 🔴 **「무료」인지는 `meetingFee`로만 판정한다. 결제액으로 판정하지 않는다.**
 * 유료 모임인데 `paid_amount = 0`인 신청이 **실제로 prod에 있다** — 2026-10-06 중복환불
 * 사고에서 신청은 남기고 돈만 돌려드린 뒤 장부를 0으로 맞춘 건들이다. 그 건은
 * "이 신청은 0원으로 처리됐다"이지 **"이 모임은 공짜였다"가 아니다.**
 * 결제액으로 판정하면 그분들 화면에 「무료」라는 거짓말이 뜬다.
 *
 * 인자를 둘 다 필수로 받는 이유도 같다 — 결제액 하나만 넘기는 호출을
 * **문법적으로 쓸 수 없게** 해서 같은 실수가 되돌아오지 못하게 한다.
 *
 * @param paidAmount 화면에 쓸 금액 (결제액 · 입금 예정액 · 표시가)
 * @param meetingFee 그 모임의 참가비 — 「무료」 판정의 유일한 근거
 */
export function formatPaidAmount(paidAmount: number, meetingFee: number): string {
  return meetingFee === 0 ? '무료' : formatFee(paidAmount)
}

/**
 * `formatPaidAmount`에 "원"까지 붙인 형태. 「무료」일 때는 단위를 빼서 "무료원"을 막는다.
 *
 * 금액 뒤에 "원"을 직접 붙이는 자리(마이페이지 신청 내역 등)가 호출한다 —
 * 호출부에서 `formatPaidAmount(...) + '원'`을 하면 "무료원"이 되므로
 * 분기를 호출부에 두지 않고 여기 한 벌만 둔다.
 */
export function formatPaidAmountWithUnit(paidAmount: number, meetingFee: number): string {
  return meetingFee === 0 ? '무료' : `${formatFee(paidAmount)}원`
}

/** Returns current KST month as "YYYY-MM" */
export function getKSTMonth(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date()).slice(0, 7)
}

/** Returns start/end dates for a given month ("YYYY-MM") */
export function getMonthRange(month: string): { start: string; end: string } {
  const [year, m] = month.split('-').map(Number)
  const start = `${year}-${String(m).padStart(2, '0')}-01`
  const end = m === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(m + 1).padStart(2, '0')}-01`
  return { start, end }
}

/** Returns the previous month as "YYYY-MM" */
export function getPrevMonth(month: string): string {
  const [year, m] = month.split('-').map(Number)
  if (m === 1) return `${year - 1}-12`
  return `${year}-${String(m - 1).padStart(2, '0')}`
}

/** Returns "YYYY-MM-DD" for 7 days from a given date */
export function getWeekLater(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + 7)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** "2026-09-06" → "9월 6일" (요일 없음 — 환불 안내처럼 문장 안에 들어갈 때) */
export function formatMonthDay(dateStr: string): string {
  const [, month, day] = dateStr.split('-').map(Number)
  return `${month}월 ${day}일`
}

/** "YYYY-MM-DD"에서 days만큼 이동 (음수 가능). 날짜 단위라 시간대 영향 없음 */
export function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** "2026-03-29" → "3월 29일 토요일" (full weekday name) */
export function formatKoreanDateFull(dateStr: string): string {
  const [, month, day] = dateStr.split('-').map(Number)
  const date = new Date(`${dateStr}T12:00:00+09:00`)
  const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']
  return `${month}월 ${day}일 ${days[date.getUTCDay()]}`
}

/** Returns the number of days between two "YYYY-MM-DD" dates (target - from) */
export function getDaysUntil(targetDate: string, fromDate: string): number {
  const target = new Date(targetDate + 'T00:00:00+09:00')
  const from = new Date(fromDate + 'T00:00:00+09:00')
  return Math.round((target.getTime() - from.getTime()) / (24 * 60 * 60 * 1000))
}

/**
 * D-Day 라벨 생성. null이면 과거 모임이거나 표시 부적합.
 * - 오늘: "오늘 14:00"
 * - 내일: "내일"
 * - 그 외 미래: "D-N"
 * - 과거: null
 */
export function formatDDay(meetingDate: string, meetingTime: string, kstToday: string): string | null {
  const days = getDaysUntil(meetingDate, kstToday)
  if (days < 0) return null
  if (days === 0) {
    if (!meetingTime) return '오늘'
    const parts = meetingTime.split(':')
    const hourStr = parts[0] ?? '0'
    const minuteStr = (parts[1] ?? '00').padStart(2, '0')
    return `오늘 ${parseInt(hourStr, 10)}:${minuteStr}`
  }
  if (days === 1) return '내일'
  return `D-${days}`
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
  | { type: 'pending_transfer' }
  // 토론모임 D-7 신청 마감 (2026-08-17 결정) — 마감 후 신청·대기 모두 차단
  | { type: 'apply_closed' }

/** Computes the action button state for a meeting detail page (PRD §6-2 + Phase 2-2 대기 + 계좌이체 브릿지) */
export function getButtonState(
  meetingDate: string,
  kstToday: string,
  hasConfirmed: boolean,
  isFull: boolean,
  hasWaitlisted: boolean = false,
  hasPendingTransfer: boolean = false,
): ButtonState {
  const timing = getMeetingTiming(meetingDate, kstToday)

  if (timing === 'before_or_today') {
    if (hasConfirmed) return { type: 'cancel' }
    if (hasPendingTransfer) return { type: 'pending_transfer' }
    if (hasWaitlisted) return { type: 'waitlist_cancel' }
    if (isFull) return { type: 'join_waitlist' }
    return { type: 'register' }
  }

  // after meeting
  if (hasConfirmed) return { type: 'attended' }
  return { type: 'none' }
}
