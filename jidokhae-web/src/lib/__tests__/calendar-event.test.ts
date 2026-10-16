import { describe, it, expect } from 'vitest'
import {
  kstToUtcStamp,
  buildCalendarEvent,
  buildIcs,
  buildGoogleCalendarUrl,
  escapeIcsText,
  foldIcsLine,
  MEETING_DURATION_MINUTES,
  type CalendarMeeting,
} from '@/lib/calendar-event'

const MEETING: CalendarMeeting = {
  id: '11111111-2222-3333-4444-555555555555',
  title: '매주 수요일 정기모임',
  date: '2026-10-21',
  time: '19:00:00',
  location: '우연히 책방',
  detail_address: null,
  meeting_type: 'regular',
}

describe('kstToUtcStamp — KST를 UTC로', () => {
  it('저녁 7시 KST는 같은 날 10시 UTC', () => {
    expect(kstToUtcStamp('2026-10-21', '19:00:00')).toBe('20261021T100000Z')
  })
  it('오전 8시 KST는 전날 23시 UTC (날짜가 넘어간다)', () => {
    expect(kstToUtcStamp('2026-10-21', '08:00')).toBe('20261020T230000Z')
  })
  it('1월 1일 새벽은 전년도 12월 31일로 넘어간다', () => {
    expect(kstToUtcStamp('2027-01-01', '07:30')).toBe('20261231T223000Z')
  })
})

describe('buildCalendarEvent', () => {
  it('정기모임은 120분', () => {
    const e = buildCalendarEvent(MEETING)
    expect(MEETING_DURATION_MINUTES.regular).toBe(120)
    expect(e.start).toBe('20261021T100000Z')
    expect(e.end).toBe('20261021T120000Z')
  })
  it('토론모임은 150분 (19:00–21:30)', () => {
    const e = buildCalendarEvent({ ...MEETING, meeting_type: 'discussion' })
    expect(e.end).toBe('20261021T123000Z')
  })
  it('모르는 유형은 정기모임 길이로', () => {
    const e = buildCalendarEvent({ ...MEETING, meeting_type: 'flash' })
    expect(e.end).toBe('20261021T120000Z')
  })
  it('상세 주소가 있으면 장소에 붙인다', () => {
    expect(buildCalendarEvent(MEETING).location).toBe('우연히 책방')
    expect(buildCalendarEvent({ ...MEETING, detail_address: '경주시 어딘가 1층' }).location).toBe(
      '우연히 책방, 경주시 어딘가 1층',
    )
  })
  it('설명에 모임 상세 주소를 넣는다', () => {
    expect(buildCalendarEvent(MEETING).description).toBe(
      '모임 상세: https://brainy-club.com/meet/11111111-2222-3333-4444-555555555555',
    )
  })
})

describe('escapeIcsText', () => {
  it('역슬래시·세미콜론·쉼표·줄바꿈을 이스케이프한다', () => {
    expect(escapeIcsText('a\\b;c,d\ne\r\nf')).toBe('a\\\\b\\;c\\,d\\ne\\nf')
  })
})

describe('foldIcsLine — 75바이트 접기', () => {
  it('짧은 줄은 그대로', () => {
    expect(foldIcsLine('SUMMARY:모임')).toBe('SUMMARY:모임')
  })
  it('한글 긴 줄은 각 줄이 75바이트 이하이고, 이어지는 줄은 공백으로 시작한다', () => {
    const folded = foldIcsLine('SUMMARY:' + '가'.repeat(60))
    const parts = folded.split('\r\n')
    expect(parts.length).toBeGreaterThan(1)
    const enc = new TextEncoder()
    for (const p of parts) expect(enc.encode(p).length).toBeLessThanOrEqual(75)
    for (const p of parts.slice(1)) expect(p.startsWith(' ')).toBe(true)
    // 접힌 것을 풀면 원래 줄이 된다 (글자가 반으로 잘리지 않는다)
    expect(folded.replace(/\r\n /g, '')).toBe('SUMMARY:' + '가'.repeat(60))
  })
})

describe('buildIcs', () => {
  const ics = buildIcs(
    buildCalendarEvent({ ...MEETING, title: '책, 그리고; 우리' }),
    new Date(Date.UTC(2026, 9, 16, 11, 0, 0)),
  )
  it('CRLF 줄바꿈으로 끝난다', () => {
    expect(ics.endsWith('\r\n')).toBe(true)
    expect(ics.split('\r\n')[0]).toBe('BEGIN:VCALENDAR')
  })
  it('UTC 시각과 DTSTAMP가 들어간다', () => {
    expect(ics).toContain('DTSTART:20261021T100000Z\r\n')
    expect(ics).toContain('DTEND:20261021T120000Z\r\n')
    expect(ics).toContain('DTSTAMP:20261016T110000Z\r\n')
  })
  it('제목의 쉼표·세미콜론은 이스케이프된다', () => {
    expect(ics).toContain('SUMMARY:책\\, 그리고\\; 우리\r\n')
  })
})

describe('buildGoogleCalendarUrl', () => {
  it('UTC 시작/끝과 제목·장소를 넣는다', () => {
    const url = new URL(buildGoogleCalendarUrl(buildCalendarEvent(MEETING)))
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render')
    expect(url.searchParams.get('action')).toBe('TEMPLATE')
    expect(url.searchParams.get('dates')).toBe('20261021T100000Z/20261021T120000Z')
    expect(url.searchParams.get('text')).toBe('매주 수요일 정기모임')
    expect(url.searchParams.get('location')).toBe('우연히 책방')
  })
})
