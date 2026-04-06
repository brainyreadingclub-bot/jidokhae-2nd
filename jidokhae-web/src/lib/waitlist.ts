/**
 * 대기 신청 관련 비즈니스 로직.
 * - promoteNextWaitlisted(): 취소 발생 시 대기자 자동 승격 (DB 함수 래퍼)
 * - processWaitlistCancel(): 대기자 직접 취소 (100% 환불)
 */

import { createServiceClient } from '@/lib/supabase/admin'
import { cancelPayment, getPayment } from '@/lib/tosspayments'
import { sendWaitlistPromotedNotification } from '@/lib/notification'

type PromoteResult = {
  promotedId: string
  promotedUserId: string
} | null

export async function promoteNextWaitlisted(meetingId: string): Promise<PromoteResult> {
  const supabase = createServiceClient()

  // 원자적 승격 — FOR UPDATE 락으로 race condition 차단
  const { data, error } = await supabase.rpc('promote_next_waitlisted', {
    p_meeting_id: meetingId,
  })

  if (error) {
    console.error('[waitlist] promote RPC 실패:', error)
    return null
  }

  const result = data as { promoted_id: string; promoted_user_id: string }[] | null
  if (!result || result.length === 0) return null

  const promoted = result[0]

  // 승격 알림톡 발송 (실패해도 승격은 유효, 계좌이체는 Phase 1에서 알림톡 미발송)
  const { data: promotedReg } = await supabase
    .from('registrations')
    .select('payment_method')
    .eq('id', promoted.promoted_id)
    .single()

  if (promotedReg?.payment_method !== 'transfer') {
    try {
      await sendWaitlistPromotedNotification(meetingId, promoted.promoted_user_id, promoted.promoted_id)
    } catch (error) {
      console.error('[waitlist] 승격 알림톡 발송 실패:', error)
    }
  }

  return { promotedId: promoted.promoted_id, promotedUserId: promoted.promoted_user_id }
}

export type WaitlistCancelResult =
  | { status: 'success'; refundedAmount: number }
  | { status: 'already_cancelled' }
  | { status: 'error'; message: string }

export async function processWaitlistCancel(
  registrationId: string,
  userId: string,
): Promise<WaitlistCancelResult> {
  const supabase = createServiceClient()

  // 1. 대기 신청 조회 + 소유권 확인
  const { data: reg, error: fetchError } = await supabase
    .from('registrations')
    .select('id, status, payment_id, paid_amount, payment_method')
    .eq('id', registrationId)
    .eq('user_id', userId)
    .single()

  if (fetchError || !reg) {
    return { status: 'error', message: '대기 신청을 찾을 수 없습니다' }
  }

  if (reg.status === 'waitlist_cancelled') {
    return { status: 'already_cancelled' }
  }

  if (reg.status !== 'waitlisted') {
    return { status: 'error', message: '취소할 수 없는 상태입니다' }
  }

  const paidAmount = reg.paid_amount ?? 0

  // 2. TossPayments 전액 환불 (계좌이체는 TossPayments 결제 아니므로 skip)
  if (reg.payment_method !== 'transfer' && paidAmount > 0 && reg.payment_id) {
    try {
      await cancelPayment(reg.payment_id, '대기 취소 전액 환불')
    } catch {
      try {
        const payment = await getPayment(reg.payment_id)
        if (payment.status !== 'CANCELED') {
          return { status: 'error', message: '환불 처리에 실패했습니다. 잠시 후 다시 시도해주세요.' }
        }
      } catch {
        return { status: 'error', message: '환불 처리에 실패했습니다. 잠시 후 다시 시도해주세요.' }
      }
    }
  }

  // 3. DB 업데이트
  const { data: updated, error: updateError } = await supabase
    .from('registrations')
    .update({
      status: 'waitlist_cancelled',
      cancel_type: 'waitlist_user_cancelled',
      refunded_amount: paidAmount,
      cancelled_at: new Date().toISOString(),
    })
    .eq('id', registrationId)
    .eq('status', 'waitlisted')
    .select('id')

  if (updateError) {
    console.error(`[waitlist] DB update failed for reg ${registrationId}:`, updateError)
    return { status: 'error', message: '취소 처리 중 오류가 발생했습니다' }
  }

  if (!updated || updated.length === 0) {
    return { status: 'already_cancelled' }
  }

  return { status: 'success', refundedAmount: paidAmount }
}
