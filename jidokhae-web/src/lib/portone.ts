/**
 * PortOne V2 Server SDK wrapper.
 * Used in API routes only — never import in client components.
 *
 * 토스 직연동과의 핵심 차이:
 * - 토스: confirmPayment 호출로 돈을 이동시킴
 * - 포트원 V2: 결제창에서 완료 시 이미 결제됨 → getPayment로 검증만 수행
 */

import { PortOneClient, type PortOneClient as PortOneClientType } from '@portone/server-sdk'

let _client: PortOneClientType | null = null

function getClient(): PortOneClientType {
  if (_client) return _client
  const secret = process.env.PORTONE_API_SECRET
  if (!secret) {
    throw new Error('PORTONE_API_SECRET is not set')
  }
  _client = PortOneClient({
    secret,
    storeId: process.env.NEXT_PUBLIC_PORTONE_STORE_ID,
  })
  return _client
}

/**
 * 정규화된 결제 정보 (토스 래퍼와 호환되는 필드 명명)
 *
 * - `paymentId`: 고객사가 채번한 주문 번호 (기존 orderId/paymentKey 역할 통합)
 * - `transactionId`: 포트원이 채번한 결제 시도 번호 (PG 거래 ID와 다름)
 * - `status`: 정규화된 상태 ('PAID' | 'CANCELLED' | 'FAILED' | 'READY' | 'PAY_PENDING' | 'VIRTUAL_ACCOUNT_ISSUED' | 'PARTIAL_CANCELLED')
 * - `totalAmount`: 결제 총액
 * - `orderName`: 주문명
 */
export type PortOnePayment = {
  paymentId: string
  transactionId: string
  status: string
  totalAmount: number
  orderName: string
}

/**
 * 결제 단건 조회.
 *
 * 포트원 V2는 결제창에서 결제 완료 시 이미 승인된 상태로 redirect.
 * 따라서 redirect 핸들러 / 웹훅에서는 getPayment로 status === 'PAID' 인지 검증.
 *
 * @throws 결제 조회 실패 시 throw
 */
export async function getPayment(paymentId: string): Promise<PortOnePayment> {
  const client = getClient()
  const payment = await client.payment.getPayment({ paymentId })

  // PortOne Payment는 union — status로 분기
  if ('status' in payment && typeof payment.status === 'string') {
    const totalAmount =
      'amount' in payment && payment.amount && typeof payment.amount.total === 'number'
        ? payment.amount.total
        : 0

    return {
      paymentId: 'id' in payment ? payment.id : paymentId,
      transactionId: 'transactionId' in payment ? payment.transactionId : '',
      status: payment.status,
      totalAmount,
      orderName: 'orderName' in payment ? payment.orderName : '',
    }
  }

  throw new Error('결제 조회 응답이 올바르지 않습니다')
}

/**
 * 결제 취소 (환불).
 *
 * @param paymentId 우리 시스템의 결제 ID (orderId)
 * @param reason 취소 사유
 * @param amount 부분 취소 금액 (생략 시 전액 취소)
 */
export async function cancelPayment(
  paymentId: string,
  reason: string,
  amount?: number,
): Promise<void> {
  const client = getClient()
  await client.payment.cancelPayment({
    paymentId,
    reason,
    ...(amount !== undefined && { amount }),
  })
}
