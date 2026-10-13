/**
 * 계좌이체 신청 결과를 화면·알림톡으로 가르는 순수 규칙 (client 번들 안전).
 *
 * 2026-10-13 대표님 확정 — **0원 모임 신청은 처음부터 「신청 완료」(confirmed).**
 * `register_transfer`가 새 반환값 'confirmed'를 돌려준다(`migration-free-transfer-confirmed.sql`).
 * 🔴 SQL 전에는 0원도 'pending_transfer'로 온다 — 그래서 화면은 반환값만 믿지 않고
 *    **모임 참가비 0이면 입금 안내를 띄우지 않는다**(`showsDepositGuide`).
 */

/** RPC 반환값 중 「자리를 잡았다」 → 신청 완료 알림톡 대상 (대기는 다른 소식이라 제외) */
export function isSeatedTransferResult(result: string): result is 'pending_transfer' | 'confirmed' {
  return result === 'pending_transfer' || result === 'confirmed'
}

/** 신청 직후 갈 완료 화면. 모르는 값이면 null(화면이 오류로 처리) */
export function transferDoneHref(meetingId: string, result: string): string | null {
  if (result === 'confirmed') return `/meetings/${meetingId}/confirm`
  if (result === 'pending_transfer') return `/meetings/${meetingId}/confirm?type=pending_transfer`
  if (result === 'waitlisted') return `/meetings/${meetingId}/confirm?type=waitlisted`
  return null
}

/** 완료 화면에 계좌·「입금해 주세요」를 띄우는가 — 0원 모임은 받을 돈이 없다 */
export function showsDepositGuide(type: string | undefined, meetingFee: number | null | undefined): boolean {
  return type === 'pending_transfer' && meetingFee !== 0
}

/** 계좌이체 단계에서 계좌·입금자명을 숨기는가 — 서버 판정(참가비 0 · 신청 금액 0)과 같은 조건 */
export function isNoTransferNeeded(meetingFee: number, chargedFee: number): boolean {
  return meetingFee === 0 && chargedFee === 0
}
