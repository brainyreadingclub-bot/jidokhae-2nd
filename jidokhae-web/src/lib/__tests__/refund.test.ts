/**
 * 환불 계산 단위 테스트
 * 시나리오 6-1-09 (KST 날짜 경계 검증) 커버
 *
 * PRD §7 환불 규칙:
 *   days_remaining >= 3 → 100%
 *   days_remaining >= 2 → 50%
 *   days_remaining < 2  → 0%
 */

import { describe, it, expect } from 'vitest'
import { calculateRefund } from '@/lib/refund'

describe('calculateRefund', () => {
  const MEETING_DATE = '2026-03-15'

  // ─── 환불율 기본 케이스 ───

  describe('환불율 기본 규칙', () => {
    it('5일 전 → 100% 환불', () => {
      const result = calculateRefund(MEETING_DATE, 10000, '2026-03-10')
      expect(result.refundRate).toBe(100)
      expect(result.daysRemaining).toBe(5)
    })

    it('4일 전 → 100% 환불', () => {
      const result = calculateRefund(MEETING_DATE, 10000, '2026-03-11')
      expect(result.refundRate).toBe(100)
      expect(result.daysRemaining).toBe(4)
    })

    it('정확히 3일 전 (경계) → 100% 환불', () => {
      const result = calculateRefund(MEETING_DATE, 10000, '2026-03-12')
      expect(result.refundRate).toBe(100)
      expect(result.daysRemaining).toBe(3)
    })

    it('정확히 2일 전 (경계) → 50% 환불', () => {
      const result = calculateRefund(MEETING_DATE, 10000, '2026-03-13')
      expect(result.refundRate).toBe(50)
      expect(result.daysRemaining).toBe(2)
    })

    it('전날 → 0% 환불', () => {
      const result = calculateRefund(MEETING_DATE, 10000, '2026-03-14')
      expect(result.refundRate).toBe(0)
      expect(result.daysRemaining).toBe(1)
    })

    it('당일 → 0% 환불', () => {
      const result = calculateRefund(MEETING_DATE, 10000, '2026-03-15')
      expect(result.refundRate).toBe(0)
      expect(result.daysRemaining).toBe(0)
    })

    it('지난 모임 → 0% 환불', () => {
      const result = calculateRefund(MEETING_DATE, 10000, '2026-03-16')
      expect(result.refundRate).toBe(0)
      expect(result.daysRemaining).toBe(-1)
    })
  })

  // ─── 환불 금액 계산 ───

  describe('환불 금액 계산', () => {
    it('100% 환불: 10,000원 → 10,000원', () => {
      const result = calculateRefund(MEETING_DATE, 10000, '2026-03-10')
      expect(result.refundAmount).toBe(10000)
    })

    it('50% 환불: 10,000원 → 5,000원', () => {
      const result = calculateRefund(MEETING_DATE, 10000, '2026-03-13')
      expect(result.refundAmount).toBe(5000)
    })

    it('50% 환불: 홀수 금액 1,001원 → 500원 (Math.floor)', () => {
      const result = calculateRefund(MEETING_DATE, 1001, '2026-03-13')
      expect(result.refundAmount).toBe(500) // floor(1001 * 50 / 100) = floor(500.5) = 500
    })

    it('0% 환불: 10,000원 → 0원', () => {
      const result = calculateRefund(MEETING_DATE, 10000, '2026-03-14')
      expect(result.refundAmount).toBe(0)
    })

    it('paidAmount = 0원 → 환불 0원', () => {
      const result = calculateRefund(MEETING_DATE, 0, '2026-03-10')
      expect(result.refundRate).toBe(100)
      expect(result.refundAmount).toBe(0)
    })

    it('소액 1,000원 100% → 1,000원', () => {
      const result = calculateRefund(MEETING_DATE, 1000, '2026-03-12')
      expect(result.refundAmount).toBe(1000)
    })

    it('소액 1,000원 50% → 500원', () => {
      const result = calculateRefund(MEETING_DATE, 1000, '2026-03-13')
      expect(result.refundAmount).toBe(500)
    })
  })

  // ─── KST 날짜 경계 (시나리오 6-1-09) ───

  describe('KST 날짜 경계', () => {
    it('3일전→2일전 경계: 03-12는 100%, 03-13은 50%', () => {
      const day3 = calculateRefund(MEETING_DATE, 10000, '2026-03-12')
      const day2 = calculateRefund(MEETING_DATE, 10000, '2026-03-13')
      expect(day3.refundRate).toBe(100)
      expect(day2.refundRate).toBe(50)
      expect(day3.daysRemaining).toBe(3)
      expect(day2.daysRemaining).toBe(2)
    })

    it('2일전→1일전 경계: 03-13은 50%, 03-14는 0%', () => {
      const day2 = calculateRefund(MEETING_DATE, 10000, '2026-03-13')
      const day1 = calculateRefund(MEETING_DATE, 10000, '2026-03-14')
      expect(day2.refundRate).toBe(50)
      expect(day1.refundRate).toBe(0)
      expect(day2.daysRemaining).toBe(2)
      expect(day1.daysRemaining).toBe(1)
    })
  })

  // ─── 반환값 구조 검증 ───

  describe('반환값 구조', () => {
    it('refundRate, refundAmount, daysRemaining 전부 포함', () => {
      const result = calculateRefund(MEETING_DATE, 10000, '2026-03-10')
      expect(result).toHaveProperty('refundRate')
      expect(result).toHaveProperty('refundAmount')
      expect(result).toHaveProperty('daysRemaining')
    })

    it('refundRate는 0, 50, 100 중 하나', () => {
      const rates = [
        calculateRefund(MEETING_DATE, 10000, '2026-03-10').refundRate,
        calculateRefund(MEETING_DATE, 10000, '2026-03-13').refundRate,
        calculateRefund(MEETING_DATE, 10000, '2026-03-15').refundRate,
      ]
      rates.forEach(rate => {
        expect([0, 50, 100]).toContain(rate)
      })
    })
  })
})
