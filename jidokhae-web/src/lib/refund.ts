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

/** 취소 모달용 한 줄 요약 — 모임 유형 분기 (토론모임 14/7, 그 외 3/2) */
export function getRefundRuleTextByType(meetingType: string | null | undefined): string {
  if (meetingType !== 'discussion') return getRefundRuleText()
  return DISCUSSION_REFUND_RULES
    .map(r => `${r.daysBeforeMeeting}일 전: ${r.rate}%`)
    .concat([`${DISCUSSION_REFUND_DEFAULT_SHORT}: ${DISCUSSION_REFUND_DEFAULT.rate}%`])
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
// 2026-10-13 대표님 결정: **14일 전까지 100% / 7일 전까지 50% / 그 이후 환불 불가(취소는 가능).**
// 옛 규칙(2026-08-14, 7일 100% / 3일 50%)을 대체하고, 열려 있던 토론모임(2026-10-27)을 포함해
// **모든 토론모임에 같은 규칙**을 쓴다 (날짜로 가르지 않는다 — 대표님 확인).
// 같은 날 D-7 신청 마감도 폐지됐다 — 환불 경계는 이제 신청 마감·책 주문 마감과 묶여 있지 않다.
// calculateRefund와 같은 날짜 단위 계산 방식을 그대로 사용한다 (KST 경계 일관성).

export const DISCUSSION_REFUND_RULES = [
  { daysBeforeMeeting: 14, rate: 100, label: '모임 14일 전까지', rateLabel: '참가비 100% 환불' },
  { daysBeforeMeeting: 7, rate: 50, label: '모임 7일 전까지', rateLabel: '참가비 50% 환불' },
] as const

export const DISCUSSION_REFUND_DEFAULT = {
  rate: 0,
  label: '모임 6일 전부터',
  rateLabel: '환불 없음 (취소는 가능)',
} as const

/** 취소 모달 한 줄 요약의 마지막 칸 — 마지막 규칙 경계 하루 뒤부터 0% */
const DISCUSSION_REFUND_DEFAULT_SHORT = `${DISCUSSION_REFUND_RULES[DISCUSSION_REFUND_RULES.length - 1].daysBeforeMeeting - 1}일 전부터`

/**
 * 토론모임 환불 계산. ⚠️ 호출부에서 직접 부르지 말 것 — `calculateRefundByType`을 거친다.
 * export는 단위 테스트용이다.
 */
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
 * 토론모임(discussion)은 14일 100% / 7일 50%, 그 외(정기 등)는 3일 100% / 2일 50%.
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
// 아래 함수가 신청 확인·모임 상세에서 같은 규칙을 미리 보여주기 위한 단일 진입점이다.
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

// ─── 계좌이체 취소 건의 「권장 환불액」 ───
// 「환불 완료」 토글(mark-refunded)이 장부에 적는 값이고, 운영자 신청자 표의 「환불 N」 표시도 이 값이다.
// 두 곳이 각자 계산하면 표시와 기록이 갈린다 — 그래서 한 함수로 묶었다.

/**
 * 회원 사정이 아니라 **운영 쪽 사정으로 닫힌** 취소 — 날짜와 상관없이 전액이다.
 * - `meeting_deleted` — CLAUDE.md 「Deletion refund: Always 100%」. 종전에는 이 자리가 환불 규정으로
 *   계산돼 모임 직전에 삭제하면 0이 적혔다 (설계서 §8-2에서 발견)
 * - `presenter_swap` — 돈 낸 회원을 발제자로 바꾸며 닫은 신청 (대표님 확정 ④ 「취소 + 전액 환불」)
 */
export const FULL_REFUND_CANCEL_TYPES: readonly string[] = ['meeting_deleted', 'presenter_swap']

export function recommendedTransferRefund(input: {
  cancelType: string | null | undefined
  meetingType: string | null | undefined
  meetingDate: string
  paidAmount: number
  /** 취소한 날 (KST "YYYY-MM-DD") — 토글 누른 날이 아니다 */
  cancelDate: string
}): number {
  if (input.cancelType && FULL_REFUND_CANCEL_TYPES.includes(input.cancelType)) {
    return Math.max(0, input.paidAmount)
  }
  return calculateRefundByType(input.meetingType, input.meetingDate, input.paidAmount, input.cancelDate)
    .refundAmount
}

/**
 * 계좌이체 신청을 닫을 때 적는 `refunded_amount` — 🔴 **0과 NULL은 뜻이 반대다.**
 * - 0    = 받은 돈 없음 (입금 전 `pending_transfer` · 0원 신청). 할 일 없음
 * - null = 입금된 건이라 운영자가 손으로 돌려줘야 함 → 정산 「환불 대기」
 *
 * 회원 취소(cancel.ts)·모임 삭제(delete route)가 같은 규칙을 쓴다. 종전에는 둘 다 `isPending ? 0 : null`이라
 * **0원 confirmed가 NULL로** 적혔다 — `is null`로 세는 집계가 「돌려줄 돈 있음」으로 센다 (2026-10-13 발견).
 */
/**
 * 「입금 전 취소」 — 계좌이체 취소 중 운영자가 입금을 확인하기 전에 닫힌 건.
 * 위 transferCloseRefundedAmount가 0을 적는 경우는 (가) 입금 전 pending_transfer 취소, (나) 0원 신청 두 가지뿐이라
 * **결제 금액이 0보다 크면 (가)로 확정된다** — 취소 당시 상태를 따로 남기는 칸이 필요 없다.
 * 회원이 몰래 입금했을 수 있으므로 회원 화면은 「입금하셨다면 운영진이 확인 후 돌려드려요」를 붙이고,
 * 운영 정산 화면은 월말 통장 대조용 읽기 전용 목록에 모은다 (2026-10-15 대표님 1안)
 */
export function isCancelledBeforeDeposit(reg: {
  status: string
  payment_method: string | null | undefined
  refunded_amount: number | null | undefined
  paid_amount: number | null | undefined
}): boolean {
  return (
    reg.status === 'cancelled' &&
    reg.payment_method === 'transfer' &&
    reg.refunded_amount === 0 &&
    (reg.paid_amount ?? 0) > 0
  )
}

export function transferCloseRefundedAmount(input: {
  wasPendingTransfer: boolean
  paidAmount: number | null
}): 0 | null {
  if (input.wasPendingTransfer) return 0
  if ((input.paidAmount ?? 0) <= 0) return 0
  return null
}
