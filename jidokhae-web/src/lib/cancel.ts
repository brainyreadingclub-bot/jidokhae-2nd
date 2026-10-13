/**
 * Shared cancel/refund business logic.
 * Pattern follows src/lib/payment.ts (processPaymentConfirmation).
 * Used by POST /api/registrations/cancel.
 */

import { createServiceClient } from '@/lib/supabase/admin'
import { cancelPayment, getPayment } from '@/lib/portone'
import { calculateRefundByType, transferCloseRefundedAmount } from '@/lib/refund'
import { getKSTToday } from '@/lib/kst'
import { isPresenterRow } from '@/lib/presenter-rules'

export type CancelResult =
  | { status: 'success'; refundedAmount: number; refundRate: number; meetingId: string }
  | { status: 'already_cancelled' }
  /** 발제자 행 — 본인이 취소할 수 없다. 빼는 것은 운영자가 한다 (대표님 확정 ⑥, 2026-10-13) */
  | { status: 'presenter_locked'; message: string }
  | { status: 'error'; message: string }

export async function processUserCancel(
  registrationId: string,
  userId: string,
): Promise<CancelResult> {
  const supabase = createServiceClient()

  // 1. Fetch registration + meeting date (ownership check via user_id)
  const { data: reg, error: fetchError } = await supabase
    .from('registrations')
    .select('id, status, payment_id, paid_amount, meeting_id, payment_method, meetings(date, meeting_type)')
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

  // 2-b. 발제자 행은 본인 취소를 막는다 — 화면만 막으면 딥링크·옛 화면으로 들어온다.
  //      본인이 빠지면 운영자가 알림 없이 발제자를 잃는다. 빼기는 운영자 화면에서만 (설계서 §9-3)
  if (isPresenterRow(reg)) {
    return { status: 'presenter_locked', message: '참석이 어려우면 운영자에게 알려 주세요' }
  }

  // 3. Must be confirmed or pending_transfer to cancel
  if (reg.status !== 'confirmed' && reg.status !== 'pending_transfer') {
    return { status: 'error', message: '취소할 수 없는 상태입니다' }
  }

  // 4. Calculate refund amount (KST date-based) — 토론모임은 14/7 규칙 (calculateRefundByType이 분기)
  const meetingRow = reg.meetings as unknown as { date: string; meeting_type: string | null }
  const meetingDate = meetingRow.date
  const paidAmount = reg.paid_amount ?? 0
  const kstToday = getKSTToday()
  const { refundAmount, refundRate } = calculateRefundByType(
    meetingRow.meeting_type,
    meetingDate,
    paidAmount,
    kstToday,
  )

  // 5a. 계좌이체 분기: TossPayments API 호출 없이 DB만 업데이트
  if (reg.payment_method === 'transfer') {
    const isPending = reg.status === 'pending_transfer'
    // 🔴 0과 NULL은 뜻이 반대다 — 0 = 받은 돈 없음 / NULL = 운영자 손 환불 대기.
    //    0원 confirmed(0원 모임)는 받은 돈이 없으므로 0이다. 종전에는 NULL로 적혀
    //    `is null`로 세는 집계가 「돌려줄 돈 있음」으로 셌다 (설계서 §2-2 · §8, 2026-10-13)
    const closeRefunded = transferCloseRefundedAmount({ wasPendingTransfer: isPending, paidAmount })
    const noMoneyReceived = closeRefunded === 0
    const { data: updated } = await supabase
      .from('registrations')
      .update({
        status: 'cancelled',
        cancel_type: 'user_cancelled',
        refunded_amount: closeRefunded, // 받은 돈 없음(0) / 입금된 confirmed: 운영자 수동 환불 대기(null)
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', registrationId)
      .eq('status', reg.status)
      .select('id')

    if (!updated || updated.length === 0) {
      return { status: 'already_cancelled' }
    }

    return {
      status: 'success',
      refundedAmount: noMoneyReceived ? 0 : refundAmount,
      refundRate: noMoneyReceived ? 0 : refundRate,
      meetingId: reg.meeting_id,
    }
  }

  // 5b. PortOne cancel (skip if 0 refund or no payment_id)
  if (refundAmount > 0 && reg.payment_id) {
    try {
      await cancelPayment(
        reg.payment_id,
        '사용자 취소',
        // 100% 환불은 amount 생략 (전액 취소), 부분 환불은 금액 지정
        refundRate === 100 ? undefined : refundAmount,
      )
    } catch {
      // Race condition safety: check if already cancelled at PortOne
      // (handles concurrent cancel where another request already succeeded)
      try {
        const payment = await getPayment(reg.payment_id)
        if (payment.status !== 'CANCELLED') {
          return {
            status: 'error',
            message: '환불 처리에 실패했습니다. 잠시 후 다시 시도해주세요.',
          }
        }
        // Already cancelled → proceed to DB update
      } catch {
        return {
          status: 'error',
          message: '환불 처리에 실패했습니다. 잠시 후 다시 시도해주세요.',
        }
      }
    }
  }

  // 6. DB update: status, cancel_type, refunded_amount, cancelled_at
  //    .select('id') to detect zero-row update (concurrent cancel won the race)
  const { data: updated, error: updateError } = await supabase
    .from('registrations')
    .update({
      status: 'cancelled',
      cancel_type: 'user_cancelled',
      refunded_amount: refundAmount,
      cancelled_at: new Date().toISOString(),
    })
    .eq('id', registrationId)
    .eq('status', 'confirmed') // optimistic lock: 여전히 confirmed인 경우만
    .select('id')

  if (updateError) {
    console.error(
      `[cancel] DB update failed after refund for reg ${registrationId}:`,
      updateError,
    )
    return { status: 'error', message: '취소 처리 중 오류가 발생했습니다' }
  }

  // Zero rows updated = concurrent cancel already completed the DB update
  if (!updated || updated.length === 0) {
    return { status: 'already_cancelled' }
  }

  return { status: 'success', refundedAmount: refundAmount, refundRate, meetingId: reg.meeting_id }
}
