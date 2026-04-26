import { describe, it, expect } from 'vitest'
import { shouldMaskConfirmedCount } from '@/lib/visibility'

describe('shouldMaskConfirmedCount', () => {
  describe('일반 사용자', () => {
    it('0명은 항상 마스킹 (기존 social proof 보존)', () => {
      expect(shouldMaskConfirmedCount(0, 6, false)).toBe(true)
    })
    it('정원 절반 미만은 마스킹 (정원 6명, 신청 2명 → 마스킹)', () => {
      expect(shouldMaskConfirmedCount(2, 6, false)).toBe(true)
    })
    it('정원 절반 도달은 노출 (정원 6명, 신청 3명 → 노출)', () => {
      expect(shouldMaskConfirmedCount(3, 6, false)).toBe(false)
    })
    it('홀수 정원 ceil 임계 (정원 5명, 신청 2명 → 마스킹, 3명 → 노출)', () => {
      expect(shouldMaskConfirmedCount(2, 5, false)).toBe(true)
      expect(shouldMaskConfirmedCount(3, 5, false)).toBe(false)
    })
    it('마감 시 노출 (마감 안내가 마스킹보다 우선)', () => {
      expect(shouldMaskConfirmedCount(6, 6, false)).toBe(false)
      expect(shouldMaskConfirmedCount(3, 3, false)).toBe(false)
    })
    it('큰 정원 검증 (정원 10명, 신청 4명 → 마스킹, 5명 → 노출)', () => {
      expect(shouldMaskConfirmedCount(4, 10, false)).toBe(true)
      expect(shouldMaskConfirmedCount(5, 10, false)).toBe(false)
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
  })
})
