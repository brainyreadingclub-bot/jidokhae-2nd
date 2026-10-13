/**
 * 토론모임 환불 규칙 단위 테스트
 * 2026-10-13 대표님 결정: 14일 전까지 100% / 7일 전까지 50% / 이후 0%(취소는 가능).
 * 옛 7/3 규칙(2026-08-14)을 대체하고, 열려 있던 모임(2026-10-27)을 포함해 모든 토론모임에 같은 규칙.
 * 날짜 단위 계산(days_remaining = 모임일 − 오늘 KST)은 그대로다.
 */

import { describe, it, expect } from 'vitest'
import {
  calculateDiscussionRefund,
  DISCUSSION_REFUND_RULES,
  DISCUSSION_REFUND_DEFAULT,
  calculateRefundByType,
  getRefundRuleTextByType,
} from '@/lib/refund'
import { shiftDate } from '@/lib/kst'

const D = '2026-11-29'
/** 모임 N일 전의 KST 날짜 */
const before = (n: number) => shiftDate(D, -n)

describe('토론모임 환불 경계 — 14일 100% / 7일 50% / 이후 0% (calculateRefundByType 단일 진입점)', () => {
  const cases: Array<[number, number]> = [
    [15, 100],
    [14, 100],
    [13, 50],
    [8, 50],
    [7, 50],
    [6, 0],
    [1, 0],
    [0, 0],
  ]
  for (const [days, rate] of cases) {
    it(`${days}일 전 → ${rate}%`, () => {
      const r = calculateRefundByType('discussion', D, 20000, before(days))
      expect(r.daysRemaining).toBe(days)
      expect(r.refundRate).toBe(rate)
      expect(r.refundAmount).toBe((20000 * rate) / 100)
    })
  }

  it('50% 구간 금액은 내림 (홀수 금액)', () => {
    expect(calculateRefundByType('discussion', D, 25001, before(10)).refundAmount).toBe(12500)
  })

  it('2026-10-27 모임(규칙을 바꾸는 날 열려 있던 모임)에도 같은 규칙 — 날짜로 가르지 않는다', () => {
    const M = '2026-10-27'
    // 2026-10-13 = 14일 전 → 100%, 2026-10-14 = 13일 전 → 50% (옛 7/3이면 100%였다)
    expect(calculateRefundByType('discussion', M, 20000, '2026-10-13').refundRate).toBe(100)
    expect(calculateRefundByType('discussion', M, 20000, '2026-10-14').refundRate).toBe(50)
    // 2026-10-21 = 6일 전 → 0% (옛 7/3이면 50%였다)
    expect(calculateRefundByType('discussion', M, 20000, '2026-10-21').refundRate).toBe(0)
  })

  it('월 경계를 넘는 14일 전', () => {
    expect(calculateRefundByType('discussion', '2026-11-05', 20000, '2026-10-22').refundRate).toBe(100)
    expect(calculateRefundByType('discussion', '2026-11-05', 20000, '2026-10-23').refundRate).toBe(50)
  })

  it('calculateDiscussionRefund와 calculateRefundByType("discussion")은 같은 값', () => {
    for (let n = 0; n <= 20; n++) {
      expect(calculateRefundByType('discussion', D, 30000, before(n))).toEqual(
        calculateDiscussionRefund(D, 30000, before(n)),
      )
    }
  })

  it('규칙 상수 — 14일/100, 7일/50, 이후 0', () => {
    expect(DISCUSSION_REFUND_RULES).toHaveLength(2)
    expect(DISCUSSION_REFUND_RULES[0]).toMatchObject({ daysBeforeMeeting: 14, rate: 100 })
    expect(DISCUSSION_REFUND_RULES[1]).toMatchObject({ daysBeforeMeeting: 7, rate: 50 })
    expect(DISCUSSION_REFUND_DEFAULT.rate).toBe(0)
  })
})

describe('정기모임 회귀 — 3일 100% / 2일 50% / 전날·당일 0% (손대지 않았다)', () => {
  const cases: Array<[number, number]> = [
    [15, 100],
    [14, 100],
    [7, 100],
    [6, 100],
    [3, 100],
    [2, 50],
    [1, 0],
    [0, 0],
  ]
  for (const [days, rate] of cases) {
    it(`${days}일 전 → ${rate}%`, () => {
      expect(calculateRefundByType('regular', D, 20000, before(days)).refundRate).toBe(rate)
    })
  }
  it('null/undefined(구 데이터) → 정기 규칙 폴백', () => {
    expect(calculateRefundByType(null, D, 20000, before(5)).refundRate).toBe(100)
    expect(calculateRefundByType(undefined, D, 20000, before(2)).refundRate).toBe(50)
    expect(calculateRefundByType(null, D, 20000, before(1)).refundRate).toBe(0)
  })
})

describe('getRefundRuleTextByType — 취소 모달 문구', () => {
  it('discussion → 14/7 문구', () => {
    expect(getRefundRuleTextByType('discussion')).toBe('14일 전: 100% · 7일 전: 50% · 6일 전부터: 0%')
  })
  it('regular → 기존 정기 문구', () => {
    expect(getRefundRuleTextByType('regular')).toBe('3일 전: 100% · 2일 전: 50% · 전날/당일: 0%')
  })
})
