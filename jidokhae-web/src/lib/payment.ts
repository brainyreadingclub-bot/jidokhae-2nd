/**
 * Shared payment confirmation logic.
 * Used by both POST /api/registrations/confirm and POST /api/webhooks/portone.
 *
 * 포트원 V2 기준 — 결제창에서 완료 시 이미 승인된 상태로 redirect됨.
 * 따라서 confirm 단계는 getPayment로 status === 'PAID' 검증만 수행.
 */

import { createServiceClient } from '@/lib/supabase/admin'
import { getPayment, cancelPayment } from '@/lib/portone'

export type ConfirmResult =
  | { status: 'success'; registrationId: string }
  | { status: 'waitlisted'; registrationId: string }
  | { status: 'full'; message: string }
  | { status: 'already_registered'; message: string }
  | { status: 'error'; message: string }

/**
 * 결제 확정 처리.
 *
 * @param paymentId 포트원 결제 ID (= 우리가 채번한 orderId, 형식: jdkh-{meetingId8}-{userId8}-{ts})
 * @param meetingId 모임 UUID
 * @param userId 사용자 UUID
 *
 * 결제 금액 검증은 서버에서 포트원 응답(totalAmount)을 meeting.fee와 직접 대조.
 * 클라이언트 입력 의존 제거 (포트원 redirect에 amount 미포함).
 */
export async function processPaymentConfirmation(
  paymentId: string,
  meetingId: string,
  userId: string,
): Promise<ConfirmResult> {
  const supabase = createServiceClient()

  // Layer 1: Idempotency — already confirmed or waitlisted with this paymentId?
  const { data: existing } = await supabase
    .from('registrations')
    .select('id, status')
    .eq('payment_id', paymentId)
    .in('status', ['confirmed', 'waitlisted'])
    .limit(1)

  if (existing && existing.length > 0) {
    return existing[0].status === 'waitlisted'
      ? { status: 'waitlisted', registrationId: existing[0].id }
      : { status: 'success', registrationId: existing[0].id }
  }

  // Verify meeting exists and is active
  const { data: meeting } = await supabase
    .from('meetings')
    .select('fee, status')
    .eq('id', meetingId)
    .single()

  if (!meeting || meeting.status !== 'active') {
    return { status: 'error', message: '신청할 수 없는 모임입니다' }
  }

  // 포트원에서 결제 검증 (이미 결제 완료 상태여야 함)
  let payment
  try {
    payment = await getPayment(paymentId)
  } catch {
    return { status: 'error', message: '결제 검증에 실패했습니다' }
  }

  if (payment.status !== 'PAID') {
    return { status: 'error', message: '결제가 완료되지 않았습니다' }
  }

  // 결제 금액 검증 — 포트원에서 확인된 실결제액과 모임 회비가 일치해야 함
  if (payment.totalAmount !== meeting.fee) {
    await safeCancel(paymentId, '결제 금액 불일치')
    return { status: 'error', message: '결제 정보가 일치하지 않습니다' }
  }

  // paymentId prefix ↔ meetingId 교차 검증
  // paymentId 형식: jdkh-{meetingId8}-{userId8}-{timestamp}
  // 공격자가 다른 모임의 paymentId를 이 요청의 meetingId와 섞어 제출한 경우 차단.
  const meetingId8 = meetingId.replace(/-/g, '').slice(0, 8)
  const paymentParts = paymentId.split('-')
  if (
    paymentParts.length < 4 ||
    paymentParts[0] !== 'jdkh' ||
    paymentParts[1] !== meetingId8
  ) {
    await safeCancel(paymentId, 'paymentId meetingId prefix 불일치')
    return { status: 'error', message: '결제 정보가 일치하지 않습니다' }
  }

  // Layer 2: Atomic registration via DB Function
  const { data: result, error: rpcError } = await supabase.rpc(
    'confirm_registration',
    {
      p_user_id: userId,
      p_meeting_id: meetingId,
      p_payment_id: paymentId,
      p_paid_amount: payment.totalAmount,
    },
  )

  if (rpcError) {
    await safeCancel(paymentId, '신청 처리 오류')
    return { status: 'error', message: '신청 처리 중 오류가 발생했습니다' }
  }

  const rpcResult = result as string

  if (rpcResult === 'success') {
    const { data: reg } = await supabase
      .from('registrations')
      .select('id')
      .eq('payment_id', paymentId)
      .eq('status', 'confirmed')
      .limit(1)

    return { status: 'success', registrationId: reg?.[0]?.id ?? '' }
  }

  if (rpcResult === 'waitlisted') {
    // 대기 신청 — 결제 유지, 환불하지 않음
    const { data: reg } = await supabase
      .from('registrations')
      .select('id')
      .eq('payment_id', paymentId)
      .eq('status', 'waitlisted')
      .limit(1)

    return { status: 'waitlisted', registrationId: reg?.[0]?.id ?? '' }
  }

  if (rpcResult === 'full') {
    // 방어 코드 — confirm_registration()이 더 이상 'full' 반환하지 않지만 안전을 위해 유지
    await safeCancel(paymentId, '정원 마감으로 인한 환불')
    return { status: 'full', message: '마감되었습니다' }
  }

  if (rpcResult === 'already_registered') {
    await safeCancel(paymentId, '중복 신청으로 인한 환불')
    return { status: 'already_registered', message: '이미 신청한 모임입니다' }
  }

  // not_found, not_active, etc.
  await safeCancel(paymentId, '모임 상태 오류')
  return { status: 'error', message: '신청할 수 없는 모임입니다' }
}

/**
 * Safe cancel — never throws.
 * On refund failure, keep confirmed status (better than no money AND no registration).
 */
async function safeCancel(paymentId: string, reason: string): Promise<void> {
  try {
    await cancelPayment(paymentId, reason)
  } catch (e) {
    console.error(`[payment] Refund failed for ${paymentId}:`, e)
  }
}
