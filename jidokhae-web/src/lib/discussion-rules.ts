/**
 * 토론모임 규칙 (순수 함수).
 * 신청 마감 = D-7 = 환불 100% 경계 = 책 주문 마감 (세 날짜 통일, 2026-08-17 확정)
 * 날짜 단위 계산 — 기존 환불 계산과 동일하게 시간 무관.
 */

import { getKSTToday, getDaysUntil } from '@/lib/kst'

export const DISCUSSION_APPLY_CLOSE_DAYS = 7

/** D-7일 23:59까지 신청 가능. daysUntil >= 7 이면 열림 */
export function isDiscussionApplyOpen(
  meetingDate: string,
  kstToday: string = getKSTToday(),
): boolean {
  return getDaysUntil(meetingDate, kstToday) >= DISCUSSION_APPLY_CLOSE_DAYS
}

/**
 * 발제 답변 쓰기 자격.
 * confirmed·pending_transfer만 — "pending_transfer는 confirmed와 동등 취급" 원칙.
 * 취소자의 기존 답변 유지는 삭제 로직이 없는 것으로 달성 (전면개편 스펙 §10 QA).
 */
export function canWriteAnswer(registrationStatus: string | null): boolean {
  return registrationStatus === 'confirmed' || registrationStatus === 'pending_transfer'
}
