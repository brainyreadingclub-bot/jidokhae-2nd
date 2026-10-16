import { describe, it, expect } from 'vitest'
import { showsFirstVisitGuide, opensFirstVisitGuide } from '@/lib/first-visit'
import type { AttendanceRow } from '@/lib/discussion-eligibility'

const TODAY = '2026-10-16'

function row(status: string, date: string, meetingType = 'regular', meetingStatus = 'active'): AttendanceRow {
  return { status, meetings: { date, meeting_type: meetingType, status: meetingStatus } }
}

describe('showsFirstVisitGuide — 정기모임에만', () => {
  it('정기모임이면 보인다', () => {
    expect(showsFirstVisitGuide('regular')).toBe(true)
  })
  it('토론모임·기타 유형·값 없음이면 안 보인다 (화이트리스트)', () => {
    expect(showsFirstVisitGuide('discussion')).toBe(false)
    expect(showsFirstVisitGuide('flash')).toBe(false)
    expect(showsFirstVisitGuide(null)).toBe(false)
    expect(showsFirstVisitGuide(undefined)).toBe(false)
  })
})

describe('opensFirstVisitGuide — 정기모임에 다녀온 적 없으면 펼친다', () => {
  it('신청 이력이 없으면 펼친다', () => {
    expect(opensFirstVisitGuide([], TODAY)).toBe(true)
  })

  it('지난 정기모임 confirmed가 있으면 접는다', () => {
    expect(opensFirstVisitGuide([row('confirmed', '2026-10-14')], TODAY)).toBe(false)
  })

  it('지난 정기모임 pending_transfer도 다녀온 것으로 센다', () => {
    expect(opensFirstVisitGuide([row('pending_transfer', '2026-10-14')], TODAY)).toBe(false)
  })

  it('앞으로 갈 정기모임만 신청해 둔 회원은 아직 처음이다 — 펼친다', () => {
    expect(opensFirstVisitGuide([row('confirmed', '2026-10-21')], TODAY)).toBe(true)
  })

  it('오늘 모임은 아직 다녀온 것이 아니다 — 펼친다', () => {
    expect(opensFirstVisitGuide([row('confirmed', TODAY)], TODAY)).toBe(true)
  })

  it('토론모임만 다녀온 회원은 정기모임이 처음이다 — 펼친다', () => {
    expect(opensFirstVisitGuide([row('confirmed', '2026-10-01', 'discussion')], TODAY)).toBe(true)
  })

  it('삭제 중인 모임의 잔재는 세지 않는다 — 펼친다', () => {
    expect(opensFirstVisitGuide([row('confirmed', '2026-10-01', 'regular', 'deleting')], TODAY)).toBe(true)
  })

  it('조회 실패(null)면 접는다', () => {
    expect(opensFirstVisitGuide(null, TODAY)).toBe(false)
  })
})
