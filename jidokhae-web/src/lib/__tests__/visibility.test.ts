import { describe, it, expect } from 'vitest'
import { shouldMaskConfirmedCount } from '@/lib/visibility'

describe('shouldMaskConfirmedCount', () => {
  describe('일반 사용자 (3명 절대 임계)', () => {
    it('0명은 마스킹', () => {
      expect(shouldMaskConfirmedCount(0, 6, false)).toBe(true)
    })
    it('1명은 마스킹', () => {
      expect(shouldMaskConfirmedCount(1, 6, false)).toBe(true)
    })
    it('2명은 마스킹', () => {
      expect(shouldMaskConfirmedCount(2, 6, false)).toBe(true)
    })
    it('3명은 노출', () => {
      expect(shouldMaskConfirmedCount(3, 6, false)).toBe(false)
    })
    it('4명 이상도 노출', () => {
      expect(shouldMaskConfirmedCount(4, 6, false)).toBe(false)
      expect(shouldMaskConfirmedCount(5, 10, false)).toBe(false)
      expect(shouldMaskConfirmedCount(7, 12, false)).toBe(false)
    })
    it('정원 무관 — 정원 12명에서 3명도 노출 (절대 임계)', () => {
      expect(shouldMaskConfirmedCount(3, 12, false)).toBe(false)
    })
    it('마감 시 노출 (마감 안내가 마스킹보다 우선)', () => {
      expect(shouldMaskConfirmedCount(6, 6, false)).toBe(false)
      expect(shouldMaskConfirmedCount(3, 3, false)).toBe(false)
    })
  })

  describe('관리자/운영자 (isPrivileged=true)', () => {
    it('0명은 마스킹 (기존 행동 보존: 운영자도 0명 카드는 N명 모집 중)', () => {
      expect(shouldMaskConfirmedCount(0, 6, true)).toBe(true)
    })
    it('1명 이상은 항상 노출 (정원 비율과 무관)', () => {
      expect(shouldMaskConfirmedCount(1, 6, true)).toBe(false)
      expect(shouldMaskConfirmedCount(2, 6, true)).toBe(false)
      expect(shouldMaskConfirmedCount(3, 10, true)).toBe(false)
    })
    it('마감 시 노출', () => {
      expect(shouldMaskConfirmedCount(6, 6, true)).toBe(false)
    })
  })
})
