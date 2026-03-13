/**
 * TossPayments Server API wrapper.
 * Used in API routes only — never import in client components.
 * Reusable in M4 (confirm) and M5 (cancel/refund).
 */

const BASE_URL = 'https://api.tosspayments.com'

function getAuthHeader(): string {
  const secretKey = process.env.TOSSPAYMENTS_SECRET_KEY!
  return `Basic ${Buffer.from(secretKey + ':').toString('base64')}`
}

const defaultHeaders = () => ({
  Authorization: getAuthHeader(),
  'Content-Type': 'application/json',
})

export type TossPayment = {
  paymentKey: string
  orderId: string
  status: string
  totalAmount: number
  method: string
  secret?: string
}

/** Confirm a payment — this is when money actually moves */
export async function confirmPayment(
  paymentKey: string,
  orderId: string,
  amount: number,
): Promise<TossPayment> {
  const res = await fetch(`${BASE_URL}/v1/payments/confirm`, {
    method: 'POST',
    headers: defaultHeaders(),
    body: JSON.stringify({ paymentKey, orderId, amount }),
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Unknown error' }))
    throw new Error(error.message || '결제 승인 실패')
  }

  return res.json()
}

/** Retrieve payment info */
export async function getPayment(paymentKey: string): Promise<TossPayment> {
  const res = await fetch(`${BASE_URL}/v1/payments/${paymentKey}`, {
    headers: { Authorization: getAuthHeader() },
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Unknown error' }))
    throw new Error(error.message || '결제 조회 실패')
  }

  return res.json()
}

/** Cancel (refund) a payment. Omit amount for full refund. */
export async function cancelPayment(
  paymentKey: string,
  reason: string,
  amount?: number,
): Promise<TossPayment> {
  const res = await fetch(`${BASE_URL}/v1/payments/${paymentKey}/cancel`, {
    method: 'POST',
    headers: defaultHeaders(),
    body: JSON.stringify({
      cancelReason: reason,
      ...(amount !== undefined && { cancelAmount: amount }),
    }),
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Unknown error' }))
    throw new Error(error.message || '환불 실패')
  }

  return res.json()
}
