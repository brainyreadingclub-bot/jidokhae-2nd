import { describe, it, expect } from 'vitest'
import { pickUpcomingRegulars, resolveHomeUpcomingClick } from '@/lib/home-upcoming'

// 날짜순 후보 (page가 이미 정렬해서 넘긴다)
const c = [
  { id: '1', region: '포항' },
  { id: '2', region: '경주' },
  { id: '3', region: '대구' },
  { id: '4', region: '포항' },
  { id: '5', region: '경주' },
  { id: '6', region: '포항' },
]
const ids = (xs: { id: string }[]) => xs.map((x) => x.id)

describe('pickUpcomingRegulars', () => {
  it('기록이 없으면 날짜순 3개', () => {
    expect(ids(pickUpcomingRegulars(c, new Set()))).toEqual(['1', '2', '3'])
  })
  it('다녀 본 지역 모임을 먼저 채운다 (3개가 다 있으면 그 지역만)', () => {
    expect(ids(pickUpcomingRegulars(c, new Set(['포항'])))).toEqual(['1', '4', '6'])
  })
  it('다녀 본 지역이 모자라면 나머지는 날짜순 다른 지역으로, 보여줄 땐 날짜순', () => {
    expect(ids(pickUpcomingRegulars(c, new Set(['대구'])))).toEqual(['1', '2', '3'])
    expect(ids(pickUpcomingRegulars(c.slice(1), new Set(['포항'])))).toEqual(['2', '4', '6'])
  })
  it('지역이 둘이면 둘 다 우선', () => {
    expect(ids(pickUpcomingRegulars(c, new Set(['경주', '대구'])))).toEqual(['2', '3', '5'])
  })
  it('후보가 3개 미만이면 있는 만큼, 0개면 빈 배열', () => {
    expect(ids(pickUpcomingRegulars(c.slice(0, 2), new Set(['포항'])))).toEqual(['1', '2'])
    expect(pickUpcomingRegulars([], new Set(['포항']))).toEqual([])
  })
})

describe('resolveHomeUpcomingClick', () => {
  const U = 'u-1'
  const M = '0b6f3c1e-1234-4abc-9def-0123456789ab'

  it('카드 클릭 — 상세에 from=home_upcoming으로 오면 meeting_click', () => {
    expect(
      resolveHomeUpcomingClick({ page: 'meeting', userId: U, from: 'home_upcoming', meetingId: M, pos: '2' }),
    ).toEqual({ event: 'home_upcoming.meeting_click', meetingId: M, props: { pos: 2 } })
  })
  it('「다른 일정도 보기」 — 목록에 from=home_upcoming_more로 오면 more_click', () => {
    expect(resolveHomeUpcomingClick({ page: 'list', userId: U, from: 'home_upcoming_more' })).toEqual({
      event: 'home_upcoming.more_click',
      meetingId: null,
      props: {},
    })
  })
  it('출처 표시가 없거나 다르면 기록하지 않는다', () => {
    expect(resolveHomeUpcomingClick({ page: 'meeting', userId: U, from: undefined, meetingId: M })).toBeNull()
    expect(resolveHomeUpcomingClick({ page: 'meeting', userId: U, from: 'lock', meetingId: M })).toBeNull()
    expect(resolveHomeUpcomingClick({ page: 'list', userId: U, from: 'lock' })).toBeNull()
    expect(resolveHomeUpcomingClick({ page: 'list', userId: U, from: undefined })).toBeNull()
  })
  it('출처를 서로 바꿔 달고 오면 기록하지 않는다 (목록에 카드 표시, 상세에 more 표시)', () => {
    expect(resolveHomeUpcomingClick({ page: 'list', userId: U, from: 'home_upcoming' })).toBeNull()
    expect(
      resolveHomeUpcomingClick({ page: 'meeting', userId: U, from: 'home_upcoming_more', meetingId: M }),
    ).toBeNull()
  })
  it('로그인 안 했으면 기록하지 않는다', () => {
    expect(resolveHomeUpcomingClick({ page: 'meeting', userId: null, from: 'home_upcoming', meetingId: M })).toBeNull()
    expect(resolveHomeUpcomingClick({ page: 'list', userId: undefined, from: 'home_upcoming_more' })).toBeNull()
  })
  it('모임 id가 UUID가 아니면 기록하지 않는다 (표의 uuid 칸을 지킨다)', () => {
    expect(
      resolveHomeUpcomingClick({ page: 'meeting', userId: U, from: 'home_upcoming', meetingId: 'abc' }),
    ).toBeNull()
    expect(resolveHomeUpcomingClick({ page: 'meeting', userId: U, from: 'home_upcoming', meetingId: null })).toBeNull()
  })
  it('위치는 1~3 정수만, 아니면 null로 남기고 클릭은 센다', () => {
    for (const pos of [undefined, '0', '4', '1.5', 'x', '-1']) {
      expect(
        (resolveHomeUpcomingClick({ page: 'meeting', userId: U, from: 'home_upcoming', meetingId: M, pos })
          ?.props as { pos: number | null }).pos,
      ).toBeNull()
    }
    expect(
      resolveHomeUpcomingClick({ page: 'meeting', userId: U, from: 'home_upcoming', meetingId: M, pos: '3' })?.props,
    ).toEqual({ pos: 3 })
  })
  it('쿼리가 배열로 와도 첫 값으로 판정한다', () => {
    expect(
      resolveHomeUpcomingClick({
        page: 'meeting',
        userId: U,
        from: ['home_upcoming', 'x'],
        meetingId: M,
        pos: ['1', '9'],
      }),
    ).toEqual({ event: 'home_upcoming.meeting_click', meetingId: M, props: { pos: 1 } })
  })
})
