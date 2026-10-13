import { describe, it, expect } from 'vitest'
import { pickUpcomingRegulars } from '@/lib/home-upcoming'

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
