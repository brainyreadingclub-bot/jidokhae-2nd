/**
 * Shared payment confirmation logic.
 * Used by both POST /api/registrations/confirm and POST /api/webhooks/tosspayments.
 */

import { createServiceClient } from '@/lib/supabase/admin'
import { confirmPayment, cancelPayment } from '@/lib/tosspayments'

export type ConfirmResult =
  | { status: 'success'; registrationId: string }
  | { status: 'waitlisted'; registrationId: string }
  | { status: 'full'; message: string }
  | { status: 'already_registered'; message: string }
  | { status: 'error'; message: string }

export async function processPaymentConfirmation(
  paymentKey: string,
  orderId: string,
  amount: number,
  meetingId: string,
  userId: string,
): Promise<ConfirmResult> {
  const supabase = createServiceClient()

  // Layer 1: Idempotency — already confirmed or waitlisted with this paymentKey?
  const { data: existing } = await supabase
    .from('registrations')
    .select('id, status')
    .eq('payment_id', paymentKey)
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
    // Don't confirm — TossPayments auto-cancels unconfirmed payments
    return { status: 'error', message: '신청할 수 없는 모임입니다' }
  }

  // Verify amount matches meeting fee
  if (amount !== meeting.fee) {
    return { status: 'error', message: '결제 금액이 일치하지 않습니다' }
  }

  // Confirm payment with TossPayments (money moves here)
  let payment
  try {
    payment = await confirmPayment(paymentKey, orderId, amount)
  } catch {
    return { status: 'error', message: '결제 승인에 실패했습니다' }
  }

  if (payment.status !== 'DONE') {
    return { status: 'error', message: '결제가 완료되지 않았습니다' }
  }

  // Layer 2: Atomic registration via DB Function
  const { data: result, error: rpcError } = await supabase.rpc(
    'confirm_registration',
    {
      p_user_id: userId,
      p_meeting_id: meetingId,
      p_payment_id: paymentKey,
      p_paid_amount: payment.totalAmount,
    },
  )

  if (rpcError) {
    await safeCancel(paymentKey, '신청 처리 오류')
    return { status: 'error', message: '신청 처리 중 오류가 발생했습니다' }
  }

  const rpcResult = result as string

  if (rpcResult === 'success') {
    const { data: reg } = await supabase
      .from('registrations')
      .select('id')
      .eq('payment_id', paymentKey)
      .eq('status', 'confirmed')
      .limit(1)

    return { status: 'success', registrationId: reg?.[0]?.id ?? '' }
  }

  if (rpcResult === 'waitlisted') {
    // 대기 신청 — 결제 유지, 환불하지 않음
    const { data: reg } = await supabase
      .from('registrations')
      .select('id')
      .eq('payment_id', paymentKey)
      .eq('status', 'waitlisted')
      .limit(1)

    return { status: 'waitlisted', registrationId: reg?.[0]?.id ?? '' }
  }

  if (rpcResult === 'full') {
    // 방어 코드 — confirm_registration()이 더 이상 'full' 반환하지 않지만 안전을 위해 유지
    await safeCancel(paymentKey, '정원 마감으로 인한 환불')
    return { status: 'full', message: '마감되었습니다' }
  }

  if (rpcResult === 'already_registered') {
    await safeCancel(paymentKey, '중복 신청으로 인한 환불')
    return { status: 'already_registered', message: '이미 신청한 모임입니다' }
  }

  // not_found, not_active, etc.
  await safeCancel(paymentKey, '모임 상태 오류')
  return { status: 'error', message: '신청할 수 없는 모임입니다' }
}

/**
 * Safe cancel — never throws.
 * On refund failure, keep confirmed status (better than no money AND no registration).
 */
async function safeCancel(paymentKey: string, reason: string): Promise<void> {
  try {
    await cancelPayment(paymentKey, reason)
  } catch (e) {
    console.error(`[payment] Refund failed for ${paymentKey}:`, e)
  }
}
