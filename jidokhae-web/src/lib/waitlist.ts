/**
 * 대기 신청 관련 비즈니스 로직.
 * - promoteNextWaitlisted(): 취소 발생 시 대기자 자동 승격 (DB 함수 래퍼)
 *
 * 대기 신청은 카드만 받는다 (2026-10-09 대표님 결정). 계좌이체 대기는
 * `register_transfer` RPC가 거절하고, 예외인 0원 건은 자리가 나면 `pending_transfer`가
 * 아니라 바로 `confirmed`로 올라간다 — 받을 돈이 없어 확인할 입금도 없다.
 * - processWaitlistCancel(): 대기자 직접 취소 (100% 환불)
 */

import { createServiceClient } from '@/lib/supabase/admin'
import { cancelPayment, getPayment } from '@/lib/portone'
import { sendWaitlistPromotedNotification } from '@/lib/notification'
import { resolvePromotedConfirmed } from '@/lib/waitlist-rules'

type PromoteResult = {
  promotedId: string
  promotedUserId: string
  /** `confirmed`로 올라갔는지. `pending_transfer`로 올라간 건은 false */
  promotedConfirmed: boolean
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

  const result = data as
    | { promoted_id: string; promoted_user_id: string; promoted_confirmed?: boolean | null }[]
    | null
  if (!result || result.length === 0) return null

  const promoted = result[0]

  // 알림톡을 가르는 기준은 **「확정으로 올라갔는가」**다 (2026-10-09 결정).
  // 종전에는 `payment_method !== 'transfer'`로 갈랐는데, 이제 0원 계좌이체 건도
  // `confirmed`로 올라가므로 수단으로 가르면 그 회원만 소식을 못 받는다.
  //
  // RPC가 `promoted_confirmed`를 돌려준다(migration-waitlist-card-only.sql).
  // 그 마이그레이션 전이면 컬럼이 없어 undefined이므로 **옛 판정으로 떨어진다** —
  // 옛 RPC가 살아 있는 동안에는 옛 판정이 정확히 맞는 판정이다. 이 폴백이 있어서
  // SQL·코드 배포 순서가 뒤집혀도 카드 승격 알림이 멈추지 않는다.
  // 판정은 `resolvePromotedConfirmed`(lib/waitlist-rules.ts) — 옛 RPC일 때만 수단을 조회한다.
  let paymentMethod: string | null | undefined
  if (typeof promoted.promoted_confirmed !== 'boolean') {
    const { data: promotedReg } = await supabase
      .from('registrations')
      .select('payment_method')
      .eq('id', promoted.promoted_id)
      .single()
    paymentMethod = promotedReg?.payment_method
  }
  const promotedConfirmed = resolvePromotedConfirmed(promoted.promoted_confirmed, paymentMethod)

  // 승격 알림톡 발송 (실패해도 승격은 유효).
  // `pending_transfer`로 올라간 건(금액 있는 계좌이체)은 종전대로 보내지 않는다.
  if (promotedConfirmed) {
    try {
      await sendWaitlistPromotedNotification(meetingId, promoted.promoted_user_id, promoted.promoted_id)
    } catch (error) {
      console.error('[waitlist] 승격 알림톡 발송 실패:', error)
    }
  }

  return {
    promotedId: promoted.promoted_id,
    promotedUserId: promoted.promoted_user_id,
    promotedConfirmed,
  }
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

  // 2. PortOne 전액 환불 (계좌이체는 카드 결제 아니므로 skip)
  if (reg.payment_method !== 'transfer' && paidAmount > 0 && reg.payment_id) {
    try {
      await cancelPayment(reg.payment_id, '대기 취소 전액 환불')
    } catch {
      try {
        const payment = await getPayment(reg.payment_id)
        if (payment.status !== 'CANCELLED') {
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
      refunded_amount: reg.payment_method === 'transfer' ? 0 : paidAmount,
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
