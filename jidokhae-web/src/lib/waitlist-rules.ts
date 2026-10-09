/**
 * 대기 신청 판정 — 순수 함수만 두는 파일(client 번들 안전).
 *
 * 2026-10-09 대표님 결정: **대기 신청은 카드만 받는다.** 받을 돈이 없는 건(0원)만 예외.
 * 진짜 방어선은 `register_transfer` RPC(FOR UPDATE 락 안)이고, 여기 판정은
 * 화면이 같은 기준으로 겉을 막도록 한 벌로 모은 것이다 (migration-waitlist-card-only.sql).
 */

import { formatPaidAmount } from '@/lib/kst'
import { paymentStatusLabel } from '@/lib/registration-status'

/**
 * 계좌이체 선택지를 감춰야 하는 대기 신청인가.
 *
 * 예외 둘 — 낼 돈이 0원이거나, 본인이 `is_free`(입금 자체가 없는 무료 참석자 —
 * 2026-10-09 밤 결정 A). 운영자의 유료 모임 신청 건은 0원인 적이 없어(정가 또는 스텝 반값)
 * 0원 예외만으로는 is_free 운영자의 계좌이체 대기가 막힌다.
 * ⚠️ is_free는 **대기 허용에만** 쓴다. 승격은 그 건의 금액으로만 가른다 —
 * is_free라도 금액이 걸린 건은 `pending_transfer`로 올라간다(migration-waitlist-card-only.sql).
 *
 * 🔴 금액은 정가가 아니라 **실제로 낼 돈**(`displayFee`/`effectiveFee`)을 넘긴다 —
 * 그 수가 그대로 `paid_amount`가 되고 RPC도 `paid_amount`로 거절한다.
 * 두 곳이 같은 수를 봐야 화면과 서버가 갈리지 않는다.
 */
export function isWaitlistCardOnly(
  isWaitlist: boolean,
  paidAmount: number,
  isFree: boolean = false,
): boolean {
  return isWaitlist && paidAmount > 0 && !isFree
}

/**
 * 승격이 `confirmed`로 올라갔는지 (승격 알림톡을 보낼지).
 *
 * 새 RPC는 `promoted_confirmed`를 돌려준다. 마이그레이션 전의 옛 RPC는 그 컬럼이 없어
 * `undefined`이므로 **옛 판정(`payment_method !== 'transfer'`)으로 떨어진다** — 옛 RPC가
 * 살아 있는 동안에는 그것이 정확한 판정이다. 그래서 SQL·코드 배포 순서를 타지 않는다.
 */
export function resolvePromotedConfirmed(
  rpcValue: boolean | null | undefined,
  paymentMethod: string | null | undefined,
): boolean {
  if (typeof rpcValue === 'boolean') return rpcValue
  return paymentMethod !== 'transfer'
}

/**
 * 신청 완료 알림톡 `#{결제금액}` 값.
 *
 * 승인된 `REGISTRATION_CONFIRM_V2`에 `#{결제상태}` 변수가 없어서 계좌이체 건은
 * **금액 값 뒤에** 상태 라벨을 붙인다 (템플릿에 없는 변수를 보내면 발송이 막힌다).
 * 0원 모임에는 붙이지 않는다 — 받을 돈이 없으니 확인할 입금도 없다.
 * 「무료」 판정은 결제액이 아니라 **모임 참가비**로 한다 (`formatPaidAmount`).
 */
export function confirmAmountText(
  paidAmount: number,
  meetingFee: number,
  status: string | null | undefined,
): string {
  const amountText = formatPaidAmount(paidAmount, meetingFee)
  if (status === 'pending_transfer' && meetingFee > 0) {
    return `${amountText} (${paymentStatusLabel('pending_transfer')})`
  }
  return amountText
}
