/**
 * 부분 환불 중복 방지 판정 (순수 함수 — 단위 테스트 대상).
 *
 * 부분 환불은 포트원에 `currentCancellableAmount`(직전 취소 가능 잔액)를 함께 보내
 * 잔액이 결제 금액 그대로일 때만 취소되게 한다. 같은 순간 두 요청이 오면 늦은 쪽은
 * 포트원에서 거절되고, 이 함수로 「이미 우리 환불이 나갔는가」를 확인한 뒤 DB 낙관적
 * 락으로 넘어가 `already_cancelled`로 끝난다.
 */

export type PaymentCancelState = {
  status: string
  cancelledAmount: number
}

/**
 * 취소 호출이 실패했을 때, 그 결제가 이미 이 환불만큼 취소돼 있는지.
 * - 전액 환불: 포트원 상태가 CANCELLED면 이미 처리됨
 * - 부분 환불: PARTIAL_CANCELLED이면서 누적 취소액이 이번 환불액과 **정확히 같을 때만**.
 *   다르면 다른 경로의 취소가 섞인 것이라 손대지 않고 실패로 돌린다(돈 확인 우선)
 */
export function isRefundAlreadyApplied(
  payment: PaymentCancelState,
  refundAmount: number,
  isFullRefund: boolean,
): boolean {
  if (isFullRefund) return payment.status === 'CANCELLED'
  return payment.status === 'PARTIAL_CANCELLED' && payment.cancelledAmount === refundAmount
}
