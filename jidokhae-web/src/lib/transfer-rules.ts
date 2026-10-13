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

/**
 * 신청 버튼을 누르면 어디로 가나 (2026-10-13 대표님 확정 — 0원은 카드 선택지를 숨긴다).
 * - 회원이 낼 금액 0 → **계좌이체 단계로 바로**(= 서버가 바로 신청 완료). 선택지가 하나라 고르는 창을 건너뛴다.
 *   🔴 `payment_mode`보다 먼저 본다 — `card_only`면 종전에는 0원으로 카드 결제창을 불러 신청 길이 막혔다.
 *   계좌이체 라우트·RPC는 `payment_mode`를 보지 않으므로 `card_only`에서도 이 길은 열려 있다.
 * - 그 외 — 종전 그대로: both·transfer_only = 결제 방법 창 / card_only·미지정 = 카드 결제창 직행
 */
export type RegisterEntry = 'transfer' | 'method' | 'card'

export function registerEntry(paymentMode: string | undefined, chargedFee: number): RegisterEntry {
  if (chargedFee === 0) return 'transfer'
  if (paymentMode === 'transfer_only' || paymentMode === 'both') return 'method'
  return 'card'
}

/** 결제 방법 창에 「카드결제」를 보이는가 — 0원은 카드로 받지 않는다(서버 `isAllowedCardAmount`도 거절) */
export function showsCardOption(chargedFee: number): boolean {
  return chargedFee > 0
}
