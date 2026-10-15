'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { trackEvent } from '@/lib/analytics'
import { getPaymentFailMessage, clipForLog } from '@/lib/payment-fail-message'
import type { SkinName } from '@/components/meetings/actionButtonSkin'

type Props = {
  meetingId: string
  /** 실패 시 돌아갈 상세 경로 (next_ui ON이면 /meet/[id]) */
  detailHref: string
  skin?: SkinName
}

/**
 * PortOne redirect 처리 — **결제 흐름 로직 무변경.**
 * 스킨 프롭은 색·문구에만 쓰인다.
 */
export default function PaymentRedirectClient({ meetingId, detailHref, skin = 'legacy' }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const processedRef = useRef(false)
  const toss = skin === 'toss'

  useEffect(() => {
    if (processedRef.current) return
    processedRef.current = true

    async function processRedirect() {
      // PortOne V2 redirect params
      // 성공: ?paymentId=...&transactionType=PAYMENT&txId=...
      // 실패/사용자 취소: ?paymentId=...&code=...&message=...
      const paymentId = searchParams.get('paymentId')
      const code = searchParams.get('code')
      const message = searchParams.get('message')

      if (!paymentId) {
        setError('결제 정보를 찾지 못했어요')
        setTimeout(() => router.replace(detailHref), 2000)
        return
      }

      // 결제 실패 / 사용자 취소
      if (code) {
        trackEvent('purchase_failed', {
          meeting_id: meetingId,
          reason: code,
        })
        // 화면에는 코드로 정한 문구만 — 주소의 message 원문은 남이 써 넣을 수 있어 로그로만
        console.warn('[payment-fail]', {
          code: clipForLog(code),
          message: clipForLog(message),
          pgMessage: clipForLog(searchParams.get('pgMessage')),
        })
        setError(
          getPaymentFailMessage({
            code,
            pgCode: searchParams.get('pgCode'),
            message,
            pgMessage: searchParams.get('pgMessage'),
          }),
        )
        setTimeout(() => router.replace(detailHref), 2000)
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
          trackEvent('purchase', {
            transaction_id: paymentId,
            currency: 'KRW',
            meeting_id: meetingId,
            registration_type: 'confirmed',
          })
          router.replace(
            `/meetings/${meetingId}/confirm?paymentId=${paymentId}`,
          )
          return
        }

        if (data.status === 'waitlisted') {
          trackEvent('purchase', {
            transaction_id: paymentId,
            currency: 'KRW',
            meeting_id: meetingId,
            registration_type: 'waitlisted',
          })
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
          setError('정원이 찼어요')
        } else if (data.status === 'already_registered') {
          setError('이미 신청한 모임이에요')
        } else {
          setError(data.message || '결제를 처리하지 못했어요')
        }

        setTimeout(() => router.replace(detailHref), 2000)
      } catch {
        setError('결제를 처리하지 못했어요')
        setTimeout(() => router.replace(detailHref), 2000)
      }
    }

    processRedirect()
  }, [meetingId, detailHref, searchParams, router])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      {error ? (
        <div className="text-center">
          {toss ? (
            <TossErrorCopy error={error} />
          ) : (
            <>
              <p className="text-sm font-bold text-error">{error}</p>
              <p className="mt-2 text-xs text-neutral-400">잠깐 뒤에 모임 화면으로 돌아가요</p>
            </>
          )}
        </div>
      ) : (
        <div className="text-center">
          <svg
            className={`mx-auto h-8 w-8 animate-spin ${toss ? 'text-brand' : 'text-primary-500'}`}
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
          <p className={`mt-4 text-sm ${toss ? 'text-tg-600' : 'text-neutral-600'}`}>
            결제 결과를 확인하고 있어요
          </p>
        </div>
      )}
    </div>
  )
}

// effect가 넣는 문구는 옛·새 화면 모두 해요체 고정 문구다 (문구표준 — docs/문구표준.md)
function TossErrorCopy({ error }: { error: string }) {
  return (
    <>
      <p className="text-sm font-bold text-warnx">{error}</p>
      <p className="mt-2 text-xs text-tg-600">잠깐 뒤에 모임 화면으로 돌아가요</p>
    </>
  )
}
