/**
 * 스텝 할인 슬롯 카운트 + displayFee 계산 헬퍼.
 *
 * 사용처
 *   - 모임 상세 page: 자격자에게 표시할 fee 결정 (자격 + 슬롯 < 2면 할인가)
 *   - transfer route: RPC 호출 전 자동 할인가 결정 (race는 RPC FOR UPDATE 락이 막음)
 *
 * 마지막 검증선
 *   RPC (confirm_registration / register_transfer)가 FOR UPDATE 락 안에서
 *   자격·슬롯 재검증. 이 헬퍼는 UX 사전 표시용. race 발생 시 RPC가 거부.
 */

import { createServiceClient } from '@/lib/supabase/admin'
import {
  STAFF_DISCOUNT_MAX_PER_MEETING,
  calculateFee,
  isStaffEligible,
} from '@/lib/pricing'

/**
 * 모임의 스텝 할인 슬롯 사용 카운트.
 * 활성 상태(confirmed / pending_transfer / waitlisted) AND is_staff_discount = true 만 카운트.
 */
export async function getStaffDiscountSlotCount(meetingId: string): Promise<number> {
  const supabase = createServiceClient()
  const { count } = await supabase
    .from('registrations')
    .select('id', { count: 'exact', head: true })
    .eq('meeting_id', meetingId)
    .eq('is_staff_discount', true)
    .in('status', ['confirmed', 'pending_transfer', 'waitlisted'])

  return count ?? 0
}

/**
 * displayFee 계산 — 화면 표시 및 PortOne 결제 금액 결정.
 *
 * @returns { fee, isDiscounted } — fee는 정가 또는 할인가, isDiscounted는 할인 적용 여부
 */
export async function getDisplayFee(
  meetingId: string,
  profile: { role: string; is_staff: boolean | null } | null,
  meetingFee: number,
): Promise<{ fee: number; isDiscounted: boolean }> {
  // 자격 없으면 정가
  if (!profile || !isStaffEligible(profile)) {
    return { fee: meetingFee, isDiscounted: false }
  }

  // 자격 있으면 슬롯 확인
  const slotCount = await getStaffDiscountSlotCount(meetingId)
  if (slotCount >= STAFF_DISCOUNT_MAX_PER_MEETING) {
    // 슬롯 마감 → 정가
    return { fee: meetingFee, isDiscounted: false }
  }

  // 자격 + 슬롯 여석 → 할인가
  return { fee: calculateFee(meetingFee, true), isDiscounted: true }
}
