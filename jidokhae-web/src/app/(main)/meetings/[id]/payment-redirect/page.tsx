'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

type Props = {
  params: Promise<{ id: string }>
}

export default function PaymentRedirectPage({ params }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function processRedirect() {
      const { id: meetingId } = await params

      // TossPayments success redirect params
      const paymentKey = searchParams.get('paymentKey')
      const orderId = searchParams.get('orderId')
      const amount = searchParams.get('amount')

      if (!paymentKey || !orderId || !amount) {
        setError('결제 정보가 없습니다')
        setTimeout(() => router.replace(`/meetings/${meetingId}`), 2000)
        return
      }

      try {
        const res = await fetch('/api/registrations/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentKey,
            orderId,
            amount: Number(amount),
            meetingId,
          }),
        })

        const data = await res.json()

        if (data.status === 'success') {
          router.replace(
            `/meetings/${meetingId}/confirm?paymentKey=${paymentKey}`,
          )
          return
        }

        if (data.status === 'full') {
          setError('마감되었습니다')
        } else if (data.status === 'already_registered') {
          setError('이미 신청한 모임입니다')
        } else {
          setError(data.message || '결제 처리 중 오류가 발생했습니다')
        }

        setTimeout(() => router.replace(`/meetings/${meetingId}`), 2000)
      } catch {
        setError('결제 처리 중 오류가 발생했습니다')
        setTimeout(() => router.replace(`/meetings/${meetingId}`), 2000)
      }
    }

    processRedirect()
  }, [params, searchParams, router])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      {error ? (
        <div className="text-center">
          <p className="text-sm font-medium text-error">{error}</p>
          <p className="mt-2 text-xs text-gray-400">
            잠시 후 모임 페이지로 이동합니다...
          </p>
        </div>
      ) : (
        <div className="text-center">
          <svg
            className="mx-auto h-8 w-8 animate-spin text-primary-500"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <p className="mt-4 text-sm text-gray-500">결제를 확인하고 있습니다...</p>
        </div>
      )}
    </div>
  )
}
