import { describe, it, expect } from 'vitest'
import {
  countsAsRegularAttendance,
  hasRegularAttendance,
  canApplyToMeeting,
  type AttendanceRow,
} from '@/lib/discussion-eligibility'
import { ASK_WINDOW_DAYS } from '@/lib/asks-pure'

const TODAY = '2026-09-14'

type MeetingOverride = Partial<{ date: string; meeting_type: string; status: string }>

/** 기본형 = 자격을 주는 행. 각 테스트는 한 축만 바꾼다 */
function row(
  over: { status?: string; meetings?: MeetingOverride | null } = {},
): AttendanceRow {
  return {
    status: over.status ?? 'confirmed',
    meetings:
      over.meetings === null
        ? null
        : { date: '2026-09-01', meeting_type: 'regular', status: 'active', ...(over.meetings ?? {}) },
  }
}

const NOBODY = { isCurator: false, hasRegularAttendance: false }
const VETERAN = { isCurator: false, hasRegularAttendance: true }
const CURATOR = { isCurator: true, hasRegularAttendance: false }

describe('countsAsRegularAttendance — 자격 있는데 막히면 안 되는 것', () => {
  it('지난 정기모임 confirmed 1건이면 통과한다', () => {
    expect(countsAsRegularAttendance(row(), TODAY)).toBe(true)
  })

  it('pending_transfer(계좌이체 입금확인 전)도 통과한다', () => {
    // 여기서 빼면 계좌이체로 참여해 온 회원이 통째로 자격을 잃는다.
    // 같은 모양의 사고가 실제로 있었다 — 리마인드 크론이 confirmed만 조회 (2026-07-30)
    expect(countsAsRegularAttendance(row({ status: 'pending_transfer' }), TODAY)).toBe(true)
  })

  it('🔴 60일보다 오래된 정기모임 참여도 자격을 준다 — 토론 자격에는 윈도우가 없다', () => {
    // 회귀 테스트(2026-08-22 결정). 누군가 isAskEligibleMeeting을 재사용하거나
    // 윈도우를 딸려 보내면 여기서 즉시 깨진다. 주석은 지워지지만 테스트는 CI가 지킨다
    expect(ASK_WINDOW_DAYS).toBe(60) // 전제: 물어보기 쪽에는 윈도우가 있다
    expect(countsAsRegularAttendance(row({ meetings: { date: '2025-09-01' } }), TODAY)).toBe(true)
    expect(countsAsRegularAttendance(row({ meetings: { date: '2024-01-15' } }), TODAY)).toBe(true)
  })

  it('어제 모임은 통과한다 — 자격은 모임 다음날 0시(KST)부터', () => {
    expect(countsAsRegularAttendance(row({ meetings: { date: '2026-09-13' } }), TODAY)).toBe(true)
  })
})

describe('countsAsRegularAttendance — 자격 없는데 통과하면 안 되는 것', () => {
  it('모임일이 아직 안 지난 선결제는 세지 않는다', () => {
    // 결제만으로 자격을 주면 정기 하나를 결제하는 그 자리에서 토론까지 신청할 수 있다
    expect(countsAsRegularAttendance(row({ meetings: { date: '2026-09-30' } }), TODAY)).toBe(false)
  })

  it('당일(오늘) 모임은 아직 미경과다', () => {
    expect(countsAsRegularAttendance(row({ meetings: { date: TODAY } }), TODAY)).toBe(false)
  })

  it('토론모임 참여는 정기 참여로 세지 않는다', () => {
    expect(countsAsRegularAttendance(row({ meetings: { meeting_type: 'discussion' } }), TODAY)).toBe(false)
  })

  it('화이트리스트 — 알 수 없는 유형(번개 등)·빈 값은 세지 않는다', () => {
    // `<> 'discussion'` 블랙리스트였다면 아래가 전부 true가 되어 게이트가 새어나간다
    expect(countsAsRegularAttendance(row({ meetings: { meeting_type: 'flash' } }), TODAY)).toBe(false)
    expect(countsAsRegularAttendance(row({ meetings: { meeting_type: '' } }), TODAY)).toBe(false)
  })

  it('삭제/삭제 중 모임은 세지 않는다 — 일괄 환불 부분 실패 잔재까지 거른다', () => {
    expect(countsAsRegularAttendance(row({ meetings: { status: 'deleted' } }), TODAY)).toBe(false)
    expect(countsAsRegularAttendance(row({ meetings: { status: 'deleting' } }), TODAY)).toBe(false)
  })

  it('참석하지 않은 status 4종은 전부 세지 않는다', () => {
    for (const status of ['waitlisted', 'cancelled', 'waitlist_cancelled', 'waitlist_refunded']) {
      expect(countsAsRegularAttendance(row({ status }), TODAY)).toBe(false)
    }
  })

  it('조인된 모임이 없으면 세지 않는다', () => {
    expect(countsAsRegularAttendance(row({ meetings: null }), TODAY)).toBe(false)
  })
})

describe('hasRegularAttendance', () => {
  it('한 건이라도 통과하면 true', () => {
    const rows = [
      row({ status: 'cancelled' }),
      row({ meetings: { meeting_type: 'discussion' } }),
      row({ meetings: { date: '2023-05-05' } }), // 3년 전 정기 — 이 한 건으로 자격
    ]
    expect(hasRegularAttendance(rows, TODAY)).toBe(true)
  })

  it('신청 이력이 없으면 false', () => {
    expect(hasRegularAttendance([], TODAY)).toBe(false)
  })

  it('토론 참여만 있는 회원은 false — 토론으로 토론 자격을 얻을 수 없다', () => {
    expect(hasRegularAttendance([row({ meetings: { meeting_type: 'discussion' } })], TODAY)).toBe(false)
  })
})

describe('canApplyToMeeting — 유형 분기 단일 진입점', () => {
  it('정기모임은 자격 검사를 하지 않는다', () => {
    expect(canApplyToMeeting('regular', NOBODY)).toBe(true)
  })

  it('미지정·미래 유형도 막지 않는다 — 자격은 토론모임에만 건다', () => {
    expect(canApplyToMeeting(null, NOBODY)).toBe(true)
    expect(canApplyToMeeting(undefined, NOBODY)).toBe(true)
    expect(canApplyToMeeting('flash', NOBODY)).toBe(true)
  })

  it('토론모임 — 정기 참여자는 통과', () => {
    expect(canApplyToMeeting('discussion', VETERAN)).toBe(true)
  })

  it('토론모임 — 운영 주체(admin·editor·is_staff)는 참여 이력 0건이어도 통과', () => {
    // 새로 임명된 editor가 첫 회차 진행을 맡는데 게이트에 걸리면 운영이 멈춘다.
    // 집합은 isCurator()와 같다 — 발제는 쓰는데 신청은 못 하는 사람을 만들지 않는다
    expect(canApplyToMeeting('discussion', CURATOR)).toBe(true)
  })

  it('🔴 토론모임 — 정기 참여 0건 + 운영 주체 아님이면 막힌다', () => {
    expect(canApplyToMeeting('discussion', NOBODY)).toBe(false)
  })
})
