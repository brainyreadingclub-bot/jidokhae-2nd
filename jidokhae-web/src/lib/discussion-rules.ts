/**
 * 토론모임 규칙 (순수 함수).
 * 신청 마감 = D-7 = 환불 100% 경계 = 책 주문 마감 (세 날짜 통일, 2026-08-17 확정)
 * 날짜 단위 계산 — 기존 환불 계산과 동일하게 시간 무관.
 */

import { getKSTToday, getDaysUntil } from '@/lib/kst'

export const DISCUSSION_APPLY_CLOSE_DAYS = 7

/**
 * D-7일 23:59까지 신청 가능. daysUntil >= 7 이면 열림.
 *
 * ⚠️ **"3중 강제"라는 기존 표현은 경로 수로는 정확하지 않다** (2026-08-22 실측으로 정정).
 * 신청 행을 만드는 경로는 **넷**이고, 그중 셋에만 이 규칙이 걸려 있다:
 *
 *   1. `lib/payment.ts`                        카드 (confirm 라우트 + PortOne 웹훅 공통)  ✅ 걸림
 *   2. `api/registrations/transfer/route.ts`   계좌이체                                   ✅ 걸림
 *   3. `lib/meeting-detail.ts`                 화면 버튼 (두 스킨 공용, 실질 방어선)      ✅ 걸림
 *   4. `api/webhooks/tosspayments/route.ts`    레거시 토스 웹훅 — `payment.ts`를 안 거치고
 *                                              `confirm_registration`을 직접 부른다        ❌ **안 걸림**
 *
 * 4번은 토스 직연동 중단으로 죽은 경로다(`status==='DONE'`인 실결제가 존재할 수 없어 통과 불가).
 * 그래서 게이트를 더 달지 않기로 했다(관리자 2026-08-22). **되살린다면 반드시 `payment.ts`를 경유시킬 것** —
 * 지금 그대로 살리면 D-7·참여 자격·격리 플래그가 통째로 빠진 상태로 신청이 만들어진다.
 * 같은 표가 참여 자격(`lib/discussion-gate.ts`)에도 그대로 적용된다.
 */
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
