/**
 * 스텝 할인 가격 계산 단위 테스트
 *
 * 정책
 *   - 자격: role IN ('admin', 'editor') OR is_staff = true
 *   - 할인율: 50%
 *   - 모임당 슬롯: 2명 (이 테스트 범위 외 — RPC 책임)
 */

import { describe, it, expect } from 'vitest'
import {
  isStaffEligible,
  isStaffDiscountableMeetingType,
  calculateFee,
  STAFF_DISCOUNT_RATE,
  STAFF_DISCOUNT_MAX_PER_MEETING,
} from '@/lib/pricing'

describe('isStaffEligible', () => {
  it('admin role → 자격 있음', () => {
    expect(isStaffEligible({ role: 'admin', is_staff: false })).toBe(true)
  })

  it('editor role → 자격 있음', () => {
    expect(isStaffEligible({ role: 'editor', is_staff: false })).toBe(true)
  })

  it('member role + is_staff=true → 자격 있음', () => {
    expect(isStaffEligible({ role: 'member', is_staff: true })).toBe(true)
  })

  it('member role + is_staff=false → 자격 없음', () => {
    expect(isStaffEligible({ role: 'member', is_staff: false })).toBe(false)
  })
})

describe('calculateFee', () => {
  it('정가 (할인 없음)', () => {
    expect(calculateFee(10000, false)).toBe(10000)
  })

  it('할인 적용 → 50%', () => {
    expect(calculateFee(10000, true)).toBe(5000)
  })

  it('홀수 fee → floor 처리', () => {
    expect(calculateFee(9999, true)).toBe(4999)
  })

  it('fee=0 edge case', () => {
    expect(calculateFee(0, true)).toBe(0)
  })
})

describe('isStaffDiscountableMeetingType (2026-08-17 결정 — 정기모임 한정)', () => {
  it('정기모임(regular) → 할인 대상', () => {
    expect(isStaffDiscountableMeetingType('regular')).toBe(true)
  })

  it('토론모임(discussion) → 할인 제외', () => {
    expect(isStaffDiscountableMeetingType('discussion')).toBe(false)
  })

  it('미래의 새 유형(예: flash) → 기본 할인 제외', () => {
    expect(isStaffDiscountableMeetingType('flash')).toBe(false)
  })
})

describe('상수 가드 (SQL과 동기 검증)', () => {
  it('STAFF_DISCOUNT_RATE은 0.5', () => {
    // 변경 시 정책 결정 필요 — SQL 영향 없음
    expect(STAFF_DISCOUNT_RATE).toBe(0.5)
  })

  it('STAFF_DISCOUNT_MAX_PER_MEETING은 2 — SQL staff_discount_max_per_meeting()과 동기', () => {
    // 변경 시 supabase/migration-staff-discount-rpcs.sql도 갱신 필수
    expect(STAFF_DISCOUNT_MAX_PER_MEETING).toBe(2)
  })
})
