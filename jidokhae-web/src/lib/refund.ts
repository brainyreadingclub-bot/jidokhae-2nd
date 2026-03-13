/**
 * Refund calculation utility.
 * Used by both client (info display) and server (actual refund).
 * Pure function — no external dependencies except KST utility.
 *
 * PRD §7 환불 규칙:
 *   days_remaining >= 3 → 100%
 *   days_remaining >= 2 → 50%
 *   days_remaining < 2  → 0% (취소는 가능, 환불 없음)
 *
 * 기준: paid_amount (meetings.fee가 아님)
 * 날짜 단위 계산 (시간 무관)
 */

import { getKSTToday } from '@/lib/kst'

export type RefundInfo = {
  refundRate: number // 0 | 50 | 100
  refundAmount: number // 실제 환불 금액
  daysRemaining: number // 모임까지 남은 일수
}

export function calculateRefund(
  meetingDate: string, // "YYYY-MM-DD"
  paidAmount: number,
  kstToday?: string, // 주입 가능 (테스트용), 미입력 시 현재 KST 날짜
): RefundInfo {
  const today = kstToday ?? getKSTToday()

  // 두 날짜 모두 "YYYY-MM-DD" KST 문자열이므로
  // 동일 방식으로 파싱하면 차이 계산이 정확함
  const meetingMs = new Date(meetingDate + 'T00:00:00').getTime()
  const todayMs = new Date(today + 'T00:00:00').getTime()
  const daysRemaining = Math.floor((meetingMs - todayMs) / (1000 * 60 * 60 * 24))

  let refundRate: number
  if (daysRemaining >= 3) {
    refundRate = 100
  } else if (daysRemaining >= 2) {
    refundRate = 50
  } else {
    refundRate = 0
  }

  return {
    refundRate,
    refundAmount: Math.floor((paidAmount * refundRate) / 100),
    daysRemaining,
  }
}
