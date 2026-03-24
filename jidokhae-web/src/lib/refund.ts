/**
 * Refund calculation utility.
 * Used by both client (info display) and server (actual refund).
 * Pure function — no external dependencies except KST utility.
 *
 * 기준: paid_amount (meetings.fee가 아님)
 * 날짜 단위 계산 (시간 무관)
 */

import { getKSTToday } from '@/lib/kst'

export const REFUND_RULES = [
  { daysBeforeMeeting: 3, rate: 100, label: '모임 3일 전까지', rateLabel: '참가비 100% 환불' },
  { daysBeforeMeeting: 2, rate: 50, label: '모임 2일 전', rateLabel: '참가비 50% 환불' },
] as const

export const REFUND_DEFAULT = {
  rate: 0,
  label: '모임 전일 · 당일',
  rateLabel: '환불 없음 (취소는 가능)',
} as const

/** 취소 모달용 한 줄 요약 */
export function getRefundRuleText(): string {
  return REFUND_RULES
    .map(r => `${r.daysBeforeMeeting}일 전: ${r.rate}%`)
    .concat([`전날/당일: ${REFUND_DEFAULT.rate}%`])
    .join(' · ')
}

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

  const meetingMs = new Date(meetingDate + 'T00:00:00').getTime()
  const todayMs = new Date(today + 'T00:00:00').getTime()
  const daysRemaining = Math.floor((meetingMs - todayMs) / (1000 * 60 * 60 * 24))

  let refundRate: number = REFUND_DEFAULT.rate
  for (const rule of REFUND_RULES) {
    if (daysRemaining >= rule.daysBeforeMeeting) {
      refundRate = rule.rate
      break
    }
  }

  return {
    refundRate,
    refundAmount: Math.floor((paidAmount * refundRate) / 100),
    daysRemaining,
  }
}
