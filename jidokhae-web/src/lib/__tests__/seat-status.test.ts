import { describe, it, expect } from 'vitest'
import {
  ceilShare,
  DEFAULT_SEAT_THRESHOLDS,
  getDetailSeatLabel,
  getSeatStatus,
  resolveSeatThresholds,
} from '@/lib/seat-status'

const member = (capacity: number, confirmed: number) =>
  getSeatStatus({ capacity, confirmed, isPrivileged: false })
const privileged = (capacity: number, confirmed: number) =>
  getSeatStatus({ capacity, confirmed, isPrivileged: true })

describe('ceilShare — 정원 × 비율 올림', () => {
  it('20%: 정원 3→1, 8→2, 10→2, 15→3, 20→4', () => {
    expect([3, 8, 10, 15, 20].map((c) => ceilShare(c, 0.2))).toEqual([1, 2, 2, 3, 4])
  })
  it('설정값 28%일 때 25 × 0.28 = 7.000000000000001 을 8로 올리지 않는다', () => {
    expect(25 * 0.28).toBeGreaterThan(7)
    expect(ceilShare(25, 0.28)).toBe(7)
  })
  it('1/3: 정원 3→1, 8→3, 9→3, 10→4, 20→7', () => {
    expect([3, 8, 9, 10, 20].map((c) => ceilShare(c, 1 / 3))).toEqual([1, 3, 3, 4, 7])
  })
})

describe('getSeatStatus — 정원 10 (남은 자리 기준 2, 함께 기준 4)', () => {
  it('0·1·2명은 가린다 — 3명 미만 가리기 유지', () => {
    for (const n of [0, 1, 2]) expect(member(10, n)).toMatchObject({ kind: 'recruiting', label: '10명 모집 중' })
  })
  it('3명 — 아직 1/3 미만이라 회원은 「모집 중」', () => {
    expect(member(10, 3)).toMatchObject({ kind: 'recruiting', label: '10명 모집 중' })
  })
  it('4명(1/3 경계) — 「4명이 함께해요」', () => {
    expect(member(10, 4)).toEqual({ kind: 'together', label: '4명이 함께해요', tone: 'normal', seatsLeft: null })
  })
  it('7명 — 남은 3자리는 기준(2) 초과라 아직 「함께해요」', () => {
    expect(member(10, 7)).toMatchObject({ kind: 'together', label: '7명이 함께해요' })
  })
  it('8명(남은 2자리 경계) — 「2자리 남았어요」 + 진한 회색 강조', () => {
    expect(member(10, 8)).toEqual({ kind: 'seats_left', label: '2자리 남았어요', tone: 'emphasis', seatsLeft: 2 })
  })
  it('9명 — 「1자리 남았어요」', () => {
    expect(member(10, 9)).toMatchObject({ kind: 'seats_left', label: '1자리 남았어요', seatsLeft: 1 })
  })
  it('10명(마감) — 지금 그대로 「10/10명」', () => {
    expect(member(10, 10)).toEqual({ kind: 'full', label: '10/10명', tone: 'normal', seatsLeft: null })
  })
  it('정원 초과(운영자 수동 추가 등)도 마감으로 본다', () => {
    expect(member(10, 11)).toMatchObject({ kind: 'full', label: '11/10명' })
  })
})

describe('getSeatStatus — 정원 3 (최소 정원)', () => {
  it('2명이면 남은 1자리가 기준(1)에 들지만, 3명 미만 가리기가 이긴다 — 인원 역산 방지', () => {
    expect(member(3, 2)).toMatchObject({ kind: 'recruiting', label: '3명 모집 중' })
  })
  it('운영진에게는 2명도 보인다 → 「1자리 남았어요」', () => {
    expect(privileged(3, 2)).toMatchObject({ kind: 'seats_left', label: '1자리 남았어요' })
  })
  it('운영진·0명은 운영진도 가린다', () => {
    expect(privileged(3, 0)).toMatchObject({ kind: 'recruiting' })
  })
  it('3명 — 마감', () => {
    expect(member(3, 3)).toMatchObject({ kind: 'full', label: '3/3명' })
  })
})

describe('getSeatStatus — 정원 8 (남은 자리 기준 2, 함께 기준 3)', () => {
  it('3명 — 「3명이 함께해요」 (가리기 끝 = 함께 기준)', () => {
    expect(member(8, 3)).toMatchObject({ kind: 'together', label: '3명이 함께해요' })
  })
  it('5명 — 남은 3자리는 기준 초과 → 함께해요', () => {
    expect(member(8, 5)).toMatchObject({ kind: 'together', label: '5명이 함께해요' })
  })
  it('6명 — 「2자리 남았어요」', () => {
    expect(member(8, 6)).toMatchObject({ kind: 'seats_left', label: '2자리 남았어요' })
  })
})

describe('getSeatStatus — 정원 20 (남은 자리 기준 4, 함께 기준 7)', () => {
  it('6명 — 1/3 미만이라 회원은 모집 중, 운영진은 정확한 수', () => {
    expect(member(20, 6)).toMatchObject({ kind: 'recruiting', label: '20명 모집 중' })
    expect(privileged(20, 6)).toMatchObject({ kind: 'exact', label: '6/20명' })
  })
  it('7명 — 「7명이 함께해요」', () => {
    expect(member(20, 7)).toMatchObject({ kind: 'together', label: '7명이 함께해요' })
  })
  it('15명 — 남은 5자리는 기준 초과', () => {
    expect(member(20, 15)).toMatchObject({ kind: 'together' })
  })
  it('16명 — 「4자리 남았어요」 (옛 홈 규칙 3자리였다면 안 떴을 자리)', () => {
    expect(member(20, 16)).toMatchObject({ kind: 'seats_left', label: '4자리 남았어요' })
  })
})

describe('어떤 경우에도 빨간색·「마감 임박」은 없다', () => {
  it('정원 3~20, 인원 0~정원 전 조합', () => {
    for (let cap = 3; cap <= 20; cap++) {
      for (let n = 0; n <= cap; n++) {
        for (const s of [member(cap, n), privileged(cap, n)]) {
          expect(['normal', 'emphasis']).toContain(s.tone)
          expect(s.label).not.toMatch(/임박|서두르/)
          // 남은 자리 문구는 늘 1자리 이상, 정원 초과 없음
          if (s.kind === 'seats_left') expect(s.seatsLeft).toBeGreaterThan(0)
        }
      }
    }
  })
})

describe('기준 비율 — site_settings', () => {
  it('키가 없으면 기본값 20% · 1/3', () => {
    expect(resolveSeatThresholds({})).toEqual(DEFAULT_SEAT_THRESHOLDS)
    expect(resolveSeatThresholds(null)).toEqual(DEFAULT_SEAT_THRESHOLDS)
  })
  it('값이 있으면 그 값', () => {
    expect(resolveSeatThresholds({ seat_left_ratio: '0.3', seat_together_ratio: '0.5' })).toEqual({
      leftRatio: 0.3,
      togetherRatio: 0.5,
    })
  })
  it('0 이하·1 초과·숫자 아님·빈 값이면 그 키만 기본값', () => {
    for (const bad of ['0', '-0.2', '1.5', 'abc', '', '  ', 'NaN', 'Infinity']) {
      expect(resolveSeatThresholds({ seat_left_ratio: bad }).leftRatio).toBe(0.2)
    }
    expect(resolveSeatThresholds({ seat_left_ratio: 'x', seat_together_ratio: '0.5' })).toEqual({
      leftRatio: 0.2,
      togetherRatio: 0.5,
    })
  })
  it('바뀐 기준이 판정에 실제로 쓰인다 — 정원 10, 남은 자리 30%면 7명부터 「3자리 남았어요」', () => {
    const thresholds = resolveSeatThresholds({ seat_left_ratio: '0.3' })
    expect(getSeatStatus({ capacity: 10, confirmed: 7, isPrivileged: false, thresholds })).toMatchObject({
      kind: 'seats_left',
      label: '3자리 남았어요',
    })
  })
})

describe('getDetailSeatLabel — 모임 상세 「참여」 칸', () => {
  const d = (meetingType: string | null, capacity: number, confirmed: number, isPrivileged = false) =>
    getDetailSeatLabel({ meetingType, capacity, confirmed, isPrivileged })

  it('정기모임은 공통 규칙', () => {
    expect(d('regular', 10, 4)).toBe('4명이 함께해요')
    expect(d('regular', 10, 8)).toBe('2자리 남았어요')
    expect(d('regular', 10, 10)).toBe('10/10명')
  })
  it('종류가 비어 있는 옛 모임은 정기 규칙', () => {
    expect(d(null, 10, 8)).toBe('2자리 남았어요')
  })
  it('토론모임은 지금 그대로 — 가리기 + n/N명 (2026-08-14 결정 정리 전까지)', () => {
    expect(d('discussion', 10, 2)).toBe('10명 모집 중')
    expect(d('discussion', 10, 4)).toBe('4/10명')
    expect(d('discussion', 10, 9)).toBe('9/10명')
    expect(d('discussion', 10, 10)).toBe('10/10명')
    expect(d('discussion', 10, 1, true)).toBe('1/10명')
  })
})
