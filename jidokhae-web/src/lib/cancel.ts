/**
 * Shared cancel/refund business logic.
 * Pattern follows src/lib/payment.ts (processPaymentConfirmation).
 * Used by POST /api/registrations/cancel.
 */

import { createServiceClient } from '@/lib/supabase/admin'
import { cancelPayment } from '@/lib/tosspayments'
import { calculateRefund } from '@/lib/refund'
import { getKSTToday } from '@/lib/kst'

export type CancelResult =
  | { status: 'success'; refundedAmount: number; refundRate: number }
  | { status: 'already_cancelled' }
  | { status: 'error'; message: string }

export async function processUserCancel(
  registrationId: string,
  userId: string,
): Promise<CancelResult> {
  const supabase = createServiceClient()

  // 1. Fetch registration + meeting date (ownership check via user_id)
  const { data: reg, error: fetchError } = await supabase
    .from('registrations')
    .select('id, status, payment_id, paid_amount, meeting_id, meetings(date)')
    .eq('id', registrationId)
    .eq('user_id', userId)
    .single()

  if (fetchError || !reg) {
    return { status: 'error', message: '신청 내역을 찾을 수 없습니다' }
  }

  // 2. Idempotency: already cancelled → safe return
  if (reg.status === 'cancelled') {
    return { status: 'already_cancelled' }
  }

  // 3. Must be confirmed to cancel
  if (reg.status !== 'confirmed') {
    return { status: 'error', message: '취소할 수 없는 상태입니다' }
  }

  // 4. Calculate refund amount (KST date-based)
  const meetingDate = (reg.meetings as unknown as { date: string }).date
  const paidAmount = reg.paid_amount ?? 0
  const kstToday = getKSTToday()
  const { refundAmount, refundRate } = calculateRefund(meetingDate, paidAmount, kstToday)

  // 5. TossPayments cancel (skip if 0 refund or no payment_id)
  if (refundAmount > 0 && reg.payment_id) {
    try {
      await cancelPayment(
        reg.payment_id,
        '사용자 취소',
        // 100% 환불은 amount 생략 (전액 취소), 부분 환불은 금액 지정
        refundRate === 100 ? undefined : refundAmount,
      )
    } catch {
      // 토스페이먼츠 실패 시: confirmed 유지, 에러 반환 (PRD 요구사항)
      return {
        status: 'error',
        message: '환불 처리에 실패했습니다. 잠시 후 다시 시도해주세요.',
      }
    }
  }

  // 6. DB update: status, cancel_type, refunded_amount, cancelled_at
  const { error: updateError } = await supabase
    .from('registrations')
    .update({
      status: 'cancelled',
      cancel_type: 'user_cancelled',
      refunded_amount: refundAmount,
      cancelled_at: new Date().toISOString(),
    })
    .eq('id', registrationId)
    .eq('status', 'confirmed') // optimistic lock: 여전히 confirmed인 경우만

  if (updateError) {
    console.error(
      `[cancel] DB update failed after refund for reg ${registrationId}:`,
      updateError,
    )
    return { status: 'error', message: '취소 처리 중 오류가 발생했습니다' }
  }

  return { status: 'success', refundedAmount: refundAmount, refundRate }
}
