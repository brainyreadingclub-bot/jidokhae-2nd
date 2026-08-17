/**
 * 스텝 할인 가격 계산 단일 진입점.
 *
 * 정책 (변경 시 SQL과 동기 필수)
 *   - 자격: role IN ('admin', 'editor') OR is_staff = true
 *   - 할인율: 50%
 *   - 모임당 슬롯: 2명
 *   - 대상: 정기모임(meeting_type = 'regular')만 — 토론모임 제외 (2026-08-17 결정)
 *
 * SQL 매핑
 *   - 자격/슬롯 검증: confirm_registration / register_transfer RPC 내부
 *   - 슬롯 상수: staff_discount_max_per_meeting() 함수 (returns 2)
 *
 * ⚠️ STAFF_DISCOUNT_MAX_PER_MEETING 변경 시
 *   supabase/migration-staff-discount-rpcs.sql의
 *   staff_discount_max_per_meeting() 반환값도 동시에 갱신할 것.
 */

export const STAFF_DISCOUNT_RATE = 0.5
export const STAFF_DISCOUNT_MAX_PER_MEETING = 2

type StaffEligibilityInput = {
  role: string
  is_staff: boolean | null
}

/**
 * 스텝 할인 자격 여부.
 * admin / editor 는 role 기반 자동 자격.
 * 일반 회원은 profile.is_staff = true 일 때만 자격.
 */
export function isStaffEligible(profile: StaffEligibilityInput): boolean {
  if (profile.role === 'admin' || profile.role === 'editor') return true
  return profile.is_staff === true
}

/**
 * 스텝 할인이 적용되는 모임 유형인지.
 * 정기모임 한정 (2026-08-17 결정 — 토론모임 25,000은 정가).
 * SQL 매핑: confirm_registration / register_transfer의 meeting_type <> 'regular' 가드
 * (migration-staff-discount-discussion-guard.sql)와 동기 필수.
 */
export function isStaffDiscountableMeetingType(meetingType: string): boolean {
  return meetingType === 'regular'
}

/**
 * 참가비 계산.
 * isStaffDiscount = true → 정가의 50% (소수점 floor)
 * isStaffDiscount = false → 정가 그대로
 *
 * @example
 *   calculateFee(10000, false) // 10000
 *   calculateFee(10000, true)  // 5000
 *   calculateFee(9999, true)   // 4999 (floor)
 *   calculateFee(0, true)      // 0
 */
export function calculateFee(baseFee: number, isStaffDiscount: boolean): number {
  if (!isStaffDiscount) return baseFee
  return Math.floor(baseFee * STAFF_DISCOUNT_RATE)
}
