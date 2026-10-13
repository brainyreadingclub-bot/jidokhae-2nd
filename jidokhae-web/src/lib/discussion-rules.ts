/**
 * 토론모임 규칙 (순수 함수).
 *
 * 2026-10-13 대표님 결정으로 **D-7 신청 마감을 폐지했다.** 토론모임도 정기모임처럼
 * 정원이 찰 때까지 받고, 차면 대기로 받는다. 책 주문 마감은 서비스에 두지 않는다.
 * (옛 결정: 2026-08-17 "신청 마감 = D-7 = 환불 100% 경계 = 책 주문 마감")
 *
 * 환불 규칙은 `lib/refund.ts`의 `calculateRefundByType`이 단일 진입점이다 — 여기 두지 않는다.
 */

import { getKSTToday, getMeetingTiming } from '@/lib/kst'

/**
 * 토론모임 카드의 「신청 열림」 표시 — 정기모임과 같은 기준으로 **모임 당일까지 열림**,
 * 지난 모임은 닫힘 (`getButtonState`의 `before_or_today`와 같은 경계).
 * 정원이 찬 경우는 「닫힘」이 아니다 — 정기모임처럼 상세에서 대기 신청으로 이어진다.
 *
 * ⚠️ 이 함수는 **화면 표시용**이다. 신청 생성 경로(`payment.ts` · transfer 라우트 ·
 * `meeting-detail.ts` 버튼)에는 토론 전용 날짜 관문이 더는 없다 — 정기모임과 같은 규칙을 탄다.
 * 토론 전용으로 남은 관문은 **참여 자격 + 격리 플래그**(`lib/discussion-gate.ts`) 하나다.
 * 그 관문이 걸린 경로 표(레거시 토스 웹훅 제외 등)는 `discussion-gate.ts`를 본다.
 */
export function isDiscussionApplyOpen(
  meetingDate: string,
  kstToday: string = getKSTToday(),
): boolean {
  return getMeetingTiming(meetingDate, kstToday) === 'before_or_today'
}

/**
 * 발제 답변 쓰기 자격.
 * confirmed·pending_transfer만 — "pending_transfer는 confirmed와 동등 취급" 원칙.
 * 취소자의 기존 답변 유지는 삭제 로직이 없는 것으로 달성 (전면개편 스펙 §10 QA).
 */
export function canWriteAnswer(registrationStatus: string | null): boolean {
  return registrationStatus === 'confirmed' || registrationStatus === 'pending_transfer'
}
