'use client'

import { useState } from 'react'
import { loadTossPayments } from '@tosspayments/payment-sdk'
import type { ButtonState } from '@/lib/kst'

type Props = {
  buttonState: ButtonState
  meetingId: string
  meetingTitle: string
  meetingFee: number
  userId: string
}

export default function MeetingActionButton({
  buttonState,
  meetingId,
  meetingTitle,
  meetingFee,
  userId,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  async function handleRegister() {
    if (loading) return
    setLoading(true)

    // orderId: 6-64 chars, [a-zA-Z0-9_-]
    const meetingId8 = meetingId.replace(/-/g, '').slice(0, 8)
    const userId8 = userId.replace(/-/g, '').slice(0, 8)
    const orderId = `jdkh-${meetingId8}-${userId8}-${Date.now()}`

    try {
      const tossPayments = await loadTossPayments(
        process.env.NEXT_PUBLIC_TOSSPAYMENTS_CLIENT_KEY!,
      )

      const origin = window.location.origin

      // TossPayments always redirects (no popup mode)
      await tossPayments.requestPayment('카드', {
        amount: meetingFee,
        orderId,
        orderName: meetingTitle,
        successUrl: `${origin}/meetings/${meetingId}/payment-redirect`,
        failUrl: `${origin}/meetings/${meetingId}/payment-fail`,
      })

      // This line is never reached — requestPaymentWindow always redirects
    } catch {
      showToast('결제 요청에 실패했습니다')
      setLoading(false)
    }
  }

  return (
    <>
      {buttonState.type === 'register' && (
        <button
          onClick={handleRegister}
          disabled={loading}
          className="w-full rounded-[var(--radius-md)] bg-primary-500 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-primary-600 active:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <svg
                className="h-4 w-4 animate-spin"
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
              결제 진행 중...
            </span>
          ) : (
            '신청하기'
          )}
        </button>
      )}

      {buttonState.type === 'full' && (
        <button
          disabled
          className="w-full rounded-[var(--radius-md)] bg-gray-100 py-3.5 text-sm font-semibold text-gray-400 cursor-not-allowed"
        >
          마감
        </button>
      )}

      {buttonState.type === 'cancel' && (
        <button
          onClick={() => showToast('취소 기능 준비 중입니다')}
          className="w-full rounded-[var(--radius-md)] border border-gray-200 bg-white py-3.5 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50 active:bg-gray-100"
        >
          취소하기
        </button>
      )}

      {buttonState.type === 'attended' && (
        <div className="w-full rounded-[var(--radius-md)] bg-success/10 py-3.5 text-center text-sm font-semibold text-success">
          참여 완료
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-gray-800 px-4 py-2 text-sm text-white shadow-lg animate-[fadeIn_0.2s_ease-out]">
          {toast}
        </div>
      )}
    </>
  )
}
