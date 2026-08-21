'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { trackEvent } from '@/lib/analytics'

type Props = {
  params: Promise<{ id: string }>
}

export default function PaymentRedirectPage({ params }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const processedRef = useRef(false)

  useEffect(() => {
    if (processedRef.current) return
    processedRef.current = true

    async function processRedirect() {
      const { id: meetingId } = await params

      // PortOne V2 redirect params
      // 성공: ?paymentId=...&transactionType=PAYMENT&txId=...
      // 실패/사용자 취소: ?paymentId=...&code=...&message=...
      const paymentId = searchParams.get('paymentId')
      const code = searchParams.get('code')
      const message = searchParams.get('message')

      if (!paymentId) {
        setError('결제 정보가 없습니다')
        setTimeout(() => router.replace(`/meetings/${meetingId}`), 2000)
        return
      }

      // 결제 실패 / 사용자 취소
      if (code) {
        trackEvent('purchase_failed', {
          meeting_id: meetingId,
          reason: code,
        })
        setError(message || '결제가 취소되었습니다')
        setTimeout(() => router.replace(`/meetings/${meetingId}`), 2000)
        return
      }

      try {
        const res = await fetch('/api/registrations/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentId,
            meetingId,
          }),
        })

        const data = await res.json()

        if (data.status === 'success') {
          // eventId = paymentId — 서버(Conversions API)와 같은 키로 메타가 dedup한다.
          // 빼면 결제 1건이 클라 1 + 서버 1 = 2건으로 잡힌다 (src/lib/meta-capi.ts)
          trackEvent(
            'purchase',
            {
              transaction_id: paymentId,
              currency: 'KRW',
              value: data.paidAmount ?? undefined,
              meeting_id: meetingId,
              registration_type: 'confirmed',
            },
            { eventId: paymentId },
          )
          router.replace(
            `/meetings/${meetingId}/confirm?paymentId=${paymentId}`,
          )
          return
        }

        if (data.status === 'waitlisted') {
          // 대기도 결제는 실제로 일어났으므로 Purchase로 잡는다
          // (미승격 시 전액 환불되지만, 메타 픽셀에 환불 이벤트 표준이 없다)
          trackEvent(
            'purchase',
            {
              transaction_id: paymentId,
              currency: 'KRW',
              value: data.paidAmount ?? undefined,
              meeting_id: meetingId,
              registration_type: 'waitlisted',
            },
            { eventId: paymentId },
          )
          router.replace(
            `/meetings/${meetingId}/confirm?type=waitlisted`,
          )
          return
        }

        trackEvent('purchase_failed', {
          meeting_id: meetingId,
          reason: data.status,
        })

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
          <p className="mt-2 text-xs text-neutral-400">
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
          <p className="mt-4 text-sm text-neutral-600">결제를 확인하고 있습니다...</p>
        </div>
      )}
    </div>
  )
}
