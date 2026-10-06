/**
 * Refund calculation utility.
 * Used by both client (info display) and server (actual refund).
 * Pure function — no external dependencies except KST utility.
 *
 * 기준: paid_amount (meetings.fee가 아님)
 * 날짜 단위 계산 (시간 무관)
 */

import { getKSTToday, shiftDate } from '@/lib/kst'

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

/** 취소 모달용 한 줄 요약 — 모임 유형 분기 (토론모임 7/3, 그 외 3/2) */
export function getRefundRuleTextByType(meetingType: string | null | undefined): string {
  if (meetingType !== 'discussion') return getRefundRuleText()
  return DISCUSSION_REFUND_RULES
    .map(r => `${r.daysBeforeMeeting}일 전: ${r.rate}%`)
    .concat([`2일 전부터: ${DISCUSSION_REFUND_DEFAULT.rate}%`])
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

// ─── 토론모임 전용 ───
// 2026-08-14 확정(7/3), 2026-08-17 D-7 신청 마감과 통일.
// calculateRefund와 같은 날짜 단위 계산 방식을 그대로 사용한다 (KST 경계 일관성).

export const DISCUSSION_REFUND_RULES = [
  { daysBeforeMeeting: 7, rate: 100, label: '모임 7일 전까지', rateLabel: '참가비 100% 환불' },
  { daysBeforeMeeting: 3, rate: 50, label: '모임 3일 전까지', rateLabel: '참가비 50% 환불' },
] as const

export const DISCUSSION_REFUND_DEFAULT = {
  rate: 0,
  label: '모임 2일 전부터',
  rateLabel: '환불 없음 (취소는 가능)',
} as const

export function calculateDiscussionRefund(
  meetingDate: string, // "YYYY-MM-DD"
  paidAmount: number,
  kstToday?: string, // 주입 가능 (테스트용)
): RefundInfo {
  const today = kstToday ?? getKSTToday()

  const meetingMs = new Date(meetingDate + 'T00:00:00').getTime()
  const todayMs = new Date(today + 'T00:00:00').getTime()
  const daysRemaining = Math.floor((meetingMs - todayMs) / (1000 * 60 * 60 * 24))

  let refundRate: number = DISCUSSION_REFUND_DEFAULT.rate
  for (const rule of DISCUSSION_REFUND_RULES) {
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

/**
 * 모임 유형 분기 환불 계산 — 단일 진입점.
 * 토론모임(discussion)은 7일 100% / 3일 50%, 그 외(정기 등)는 3일 100% / 2일 50%.
 * 실환불(cancel.ts)·권장액(mark-refunded)·화면 표시가 전부 이 함수를 거쳐야
 * 유형별 규칙이 어긋나지 않는다 (2026-08-21 배선).
 */
export function calculateRefundByType(
  meetingType: string | null | undefined,
  meetingDate: string,
  paidAmount: number,
  kstToday?: string,
): RefundInfo {
  return meetingType === 'discussion'
    ? calculateDiscussionRefund(meetingDate, paidAmount, kstToday)
    : calculateRefund(meetingDate, paidAmount, kstToday)
}

// ─── 결제 **전**에 보여주는 환불 안내 ───
// 지금까지 환불 규정은 "취소하기"를 눌러야 뜨는 모달 안에만 있었다
// (MeetingActionButton cancelPhase === 'info'). 즉 **회원이 조건을 모른 채 돈을 보냈다.**
// 아래 두 함수가 신청 확인·모임 상세에서 같은 규칙을 미리 보여주기 위한 단일 진입점이다.
// 규칙 자체는 위 RULES 상수를 그대로 읽는다 — 날짜·비율을 손으로 적으면 어긋난다.

export type RefundStep = {
  /** 환불 비율 (100 | 50) */
  rate: number
  /** 모임 며칠 전까지인지 */
  daysBefore: number
  /** 그 경계 날짜 "YYYY-MM-DD" (= 모임일 − daysBefore) */
  date: string
}

/** 유형별 환불 단계 — 상세·신청 확인 화면의 안내 문구용 */
export function getRefundScheduleByType(
  meetingType: string | null | undefined,
  meetingDate: string,
): RefundStep[] {
  const rules = meetingType === 'discussion' ? DISCUSSION_REFUND_RULES : REFUND_RULES
  return rules.map((r) => ({
    rate: r.rate,
    daysBefore: r.daysBeforeMeeting,
    date: shiftDate(meetingDate, -r.daysBeforeMeeting),
  }))
}

/**
 * 100% 환불 경계일 — 토론모임은 신청 마감·책 주문 마감과 **같은 날**이다
 * (2026-08-17 "세 날짜 통일" 결정). 그래서 여기서 한 번 계산해 셋 다 쓴다.
 */
export function getFullRefundDeadline(
  meetingType: string | null | undefined,
  meetingDate: string,
): string {
  const schedule = getRefundScheduleByType(meetingType, meetingDate)
  const full = schedule.find((s) => s.rate === 100)
  return full ? full.date : meetingDate
}
