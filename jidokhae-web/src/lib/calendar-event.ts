/**
 * 「내 달력에 추가」 — 모임 한 건을 달력 일정(.ics · 구글 캘린더 링크)으로 만든다.
 * 순수 함수만 둔다 (client 번들 안전, Supabase import 없음). 조회는 `calendar-event-server.ts`.
 *
 * 시각은 전부 KST로 받아 UTC(`...Z`)로 내보낸다. 달력 앱이 기기 시간대로 다시 바꿔 보여준다 —
 * 해외에서 열어도 한국 시각 기준으로 같은 순간을 가리킨다.
 */

/** 일정 상세에 넣을 모임 상세 주소의 바탕. `app/layout.tsx`의 `metadataBase`와 같은 값 */
export const SITE_ORIGIN = 'https://brainy-club.com'

/**
 * 모임 길이(분). 끝 시각은 DB에 없어 유형별로 잡는다.
 *
 * - regular 120 — 🟨 추정. 정기모임 소개글(2026-10-16 조회)에 끝 시각이 없다.
 *   「독서(20분)-휴식-독서(20분)-휴식-생각나누기」 순서에서 약 2시간으로 잡았다. 대표님 확인 전
 * - discussion 150 — 10/27 토론모임 소개글 「19:00에 시작해 21:30에 마쳐요」
 *
 * 그 밖의 유형은 regular 값으로 떨어진다.
 */
export const MEETING_DURATION_MINUTES: Record<string, number> = {
  regular: 120,
  discussion: 150,
}

export type CalendarMeeting = {
  id: string
  title: string
  date: string // "YYYY-MM-DD" (KST)
  time: string // "HH:MM" 또는 "HH:MM:SS" (KST)
  location: string
  detail_address: string | null
  meeting_type: string | null
}

export type CalendarEvent = {
  uid: string
  title: string
  /** UTC "YYYYMMDDTHHMMSSZ" */
  start: string
  /** UTC "YYYYMMDDTHHMMSSZ" */
  end: string
  location: string
  description: string
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function toUtcStamp(ms: number): string {
  const d = new Date(ms)
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  )
}

/** KST 날짜·시각 → UTC 밀리초. `new Date()`로 지금을 읽지 않는다 — 인자만으로 계산한다 */
function kstToUtcMs(date: string, time: string): number {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  return Date.UTC(y, m - 1, d, hh - 9, mm || 0)
}

/** KST 날짜·시각 → UTC "YYYYMMDDTHHMMSSZ" (예: 2026-10-21 19:00 → 20261021T100000Z) */
export function kstToUtcStamp(date: string, time: string): string {
  return toUtcStamp(kstToUtcMs(date, time))
}

export function buildCalendarEvent(meeting: CalendarMeeting): CalendarEvent {
  const startMs = kstToUtcMs(meeting.date, meeting.time)
  const minutes =
    MEETING_DURATION_MINUTES[meeting.meeting_type ?? ''] ?? MEETING_DURATION_MINUTES.regular
  return {
    uid: `meeting-${meeting.id}@brainy-club.com`,
    title: meeting.title,
    start: toUtcStamp(startMs),
    end: toUtcStamp(startMs + minutes * 60 * 1000),
    location: [meeting.location, meeting.detail_address].filter(Boolean).join(', '),
    description: `모임 상세: ${SITE_ORIGIN}/meet/${meeting.id}`,
  }
}

/** RFC 5545 TEXT 이스케이프 — 역슬래시·세미콜론·쉼표·줄바꿈 */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

/**
 * RFC 5545 줄 접기 — 한 줄 75바이트(UTF-8) 이하. 한글은 3바이트라 글자 수로 자르면 넘친다.
 * 이어지는 줄은 공백 하나로 시작한다.
 */
export function foldIcsLine(line: string): string {
  const encoder = new TextEncoder()
  const parts: string[] = []
  let current = ''
  let bytes = 0
  for (const ch of line) {
    const size = encoder.encode(ch).length
    // 첫 줄은 75바이트, 이어지는 줄은 앞 공백 1바이트를 빼고 74바이트
    const limit = parts.length === 0 ? 75 : 74
    if (bytes + size > limit) {
      parts.push(current)
      current = ''
      bytes = 0
    }
    current += ch
    bytes += size
  }
  parts.push(current)
  return parts.join('\r\n ')
}

/** .ics 본문. `now`는 DTSTAMP(파일을 만든 시각)에만 쓴다 — 시간대와 무관한 UTC 값이다 */
export function buildIcs(event: CalendarEvent, now: Date): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//JIDOKHAE//Meeting//KO',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${toUtcStamp(now.getTime())}`,
    `DTSTART:${event.start}`,
    `DTEND:${event.end}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    `LOCATION:${escapeIcsText(event.location)}`,
    `DESCRIPTION:${escapeIcsText(event.description)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.map(foldIcsLine).join('\r\n') + '\r\n'
}

/** 구글 캘린더 「일정 만들기」 링크 */
export function buildGoogleCalendarUrl(event: CalendarEvent): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${event.start}/${event.end}`,
    location: event.location,
    details: event.description,
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}
