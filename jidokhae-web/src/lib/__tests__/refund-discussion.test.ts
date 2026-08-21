/**
 * 토론모임 환불 규칙 단위 테스트
 * 2026-08-14 확정(7일 100% / 3일 50% / 이후 0%), 2026-08-17 D-7 마감 통일
 */

import { describe, it, expect } from 'vitest'
import {
  calculateDiscussionRefund,
  DISCUSSION_REFUND_RULES,
  calculateRefundByType,
  getRefundRuleTextByType,
} from '@/lib/refund'

describe('calculateDiscussionRefund — 7일 100% / 3일 50% / 이후 0%', () => {
  const D = '2026-09-13'

  it('8일 전 → 100%', () => {
    const r = calculateDiscussionRefund(D, 25000, '2026-09-05')
    expect(r.refundRate).toBe(100)
    expect(r.refundAmount).toBe(25000)
    expect(r.daysRemaining).toBe(8)
  })
  it('7일 전(=신청 마감일) → 100%', () => {
    expect(calculateDiscussionRefund(D, 25000, '2026-09-06').refundRate).toBe(100)
  })
  it('6일 전 → 50%', () => {
    const r = calculateDiscussionRefund(D, 25000, '2026-09-07')
    expect(r.refundRate).toBe(50)
    expect(r.refundAmount).toBe(12500)
  })
  it('3일 전 → 50%', () => {
    expect(calculateDiscussionRefund(D, 25000, '2026-09-10').refundRate).toBe(50)
  })
  it('2일 전 → 0%', () => {
    expect(calculateDiscussionRefund(D, 25000, '2026-09-11').refundRate).toBe(0)
  })
  it('당일 → 0%', () => {
    expect(calculateDiscussionRefund(D, 25000, '2026-09-13').refundRate).toBe(0)
  })
  it('규칙 상수 — 7일/100, 3일/50', () => {
    expect(DISCUSSION_REFUND_RULES[0]).toMatchObject({ daysBeforeMeeting: 7, rate: 100 })
    expect(DISCUSSION_REFUND_RULES[1]).toMatchObject({ daysBeforeMeeting: 3, rate: 50 })
  })
})

describe('calculateRefundByType — 유형 분기 배선 (2026-08-21)', () => {
  const D = '2026-09-13'

  it('discussion → 7/3 규칙 (5일 전 = 50%)', () => {
    const r = calculateRefundByType('discussion', D, 20000, '2026-09-08')
    expect(r.refundRate).toBe(50)
    expect(r.refundAmount).toBe(10000)
  })
  it('regular → 3/2 규칙 (5일 전 = 100%)', () => {
    const r = calculateRefundByType('regular', D, 20000, '2026-09-08')
    expect(r.refundRate).toBe(100)
  })
  it('null/undefined(구 데이터) → 정기 규칙 폴백', () => {
    expect(calculateRefundByType(null, D, 20000, '2026-09-08').refundRate).toBe(100)
    expect(calculateRefundByType(undefined, D, 20000, '2026-09-08').refundRate).toBe(100)
  })
  it('discussion 2일 전 → 0%', () => {
    expect(calculateRefundByType('discussion', D, 20000, '2026-09-11').refundRate).toBe(0)
  })
})

describe('getRefundRuleTextByType — 취소 모달 문구', () => {
  it('discussion → 7/3 문구', () => {
    expect(getRefundRuleTextByType('discussion')).toBe('7일 전: 100% · 3일 전: 50% · 2일 전부터: 0%')
  })
  it('regular → 기존 정기 문구', () => {
    expect(getRefundRuleTextByType('regular')).toBe('3일 전: 100% · 2일 전: 50% · 전날/당일: 0%')
  })
})
