'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { loadTossPayments } from '@tosspayments/payment-sdk'
import type { ButtonState } from '@/lib/kst'
import { formatFee } from '@/lib/kst'
import { calculateRefund } from '@/lib/refund'

type Props = {
  buttonState: ButtonState
  meetingId: string
  meetingTitle: string
  meetingFee: number
  meetingDate: string
  userId: string
  registrationId?: string
  paidAmount?: number | null
}

type CancelPhase = 'idle' | 'info' | 'confirm' | 'processing' | 'complete'

export default function MeetingActionButton({
  buttonState,
  meetingId,
  meetingTitle,
  meetingFee,
  meetingDate,
  userId,
  registrationId,
  paidAmount,
}: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [cancelPhase, setCancelPhase] = useState<CancelPhase>('idle')
  const [cancelResult, setCancelResult] = useState<{
    refundedAmount: number
    refundRate: number
  } | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  // --- Register (기존 M4 코드 그대로) ---
  async function handleRegister() {
    if (loading) return
    setLoading(true)

    const meetingId8 = meetingId.replace(/-/g, '').slice(0, 8)
    const userId8 = userId.replace(/-/g, '').slice(0, 8)
    const orderId = `jdkh-${meetingId8}-${userId8}-${Date.now()}`

    try {
      const tossPayments = await loadTossPayments(
        process.env.NEXT_PUBLIC_TOSSPAYMENTS_CLIENT_KEY!,
      )

      const origin = window.location.origin

      await tossPayments.requestPayment('카드', {
        amount: meetingFee,
        orderId,
        orderName: meetingTitle,
        successUrl: `${origin}/meetings/${meetingId}/payment-redirect`,
        failUrl: `${origin}/meetings/${meetingId}/payment-fail`,
      })
    } catch {
      showToast('결제 요청에 실패했습니다')
      setLoading(false)
    }
  }

  // --- Cancel flow ---
  const refundInfo = paidAmount
    ? calculateRefund(meetingDate, paidAmount)
    : null

  async function handleCancelConfirm() {
    if (!registrationId) return
    setCancelPhase('processing')

    try {
      const res = await fetch('/api/registrations/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationId }),
      })

      const data = await res.json()

      if (data.status === 'success') {
        setCancelResult({
          refundedAmount: data.refundedAmount,
          refundRate: data.refundRate,
        })
        setCancelPhase('complete')
        router.refresh()
      } else if (data.status === 'already_cancelled') {
        setCancelPhase('idle')
        showToast('이미 취소된 신청입니다')
        router.refresh()
      } else {
        setCancelPhase('idle')
        showToast(data.message || '취소에 실패했습니다')
      }
    } catch {
      setCancelPhase('idle')
      showToast('네트워크 오류가 발생했습니다')
    }
  }

  return (
    <>
      {/* === Register button === */}
      {buttonState.type === 'register' && (
        <button
          onClick={handleRegister}
          disabled={loading}
          className="w-full rounded-[var(--radius-md)] bg-primary-500 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-primary-600 active:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <Spinner />
              결제 진행 중...
            </span>
          ) : (
            '신청하기'
          )}
        </button>
      )}

      {/* === Full (마감) === */}
      {buttonState.type === 'full' && (
        <button
          disabled
          className="w-full rounded-[var(--radius-md)] bg-gray-100 py-3.5 text-sm font-semibold text-gray-400 cursor-not-allowed"
        >
          마감
        </button>
      )}

      {/* === Cancel button === */}
      {buttonState.type === 'cancel' && cancelPhase === 'idle' && (
        <button
          onClick={() => setCancelPhase('info')}
          className="w-full rounded-[var(--radius-md)] border border-gray-200 bg-white py-3.5 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50 active:bg-gray-100"
        >
          취소하기
        </button>
      )}

      {/* === Cancel complete (replaces button area) === */}
      {cancelPhase === 'complete' && cancelResult && (
        <div className="rounded-[var(--radius-lg)] border border-gray-100 bg-white p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-success"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h3 className="text-base font-bold text-gray-900">취소 완료</h3>
          <p className="mt-2 text-sm text-gray-500">
            {cancelResult.refundedAmount > 0 ? (
              <>
                환불 예정 금액:{' '}
                <span className="font-semibold text-gray-900">
                  {formatFee(cancelResult.refundedAmount)}
                </span>
                <br />
                <span className="text-xs text-gray-400">
                  영업일 기준 3~5일 내 환불됩니다
                </span>
              </>
            ) : (
              '환불 불가 기간으로 환불 금액이 없습니다'
            )}
          </p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 w-full rounded-[var(--radius-md)] bg-primary-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-600"
          >
            모임 일정으로
          </button>
        </div>
      )}

      {/* === Attended === */}
      {buttonState.type === 'attended' && (
        <div className="w-full rounded-[var(--radius-md)] bg-success/10 py-3.5 text-center text-sm font-semibold text-success">
          참여 완료
        </div>
      )}

      {/* === Cancel Info Modal (Phase 1) === */}
      {cancelPhase === 'info' && refundInfo && (
        <ModalOverlay onClose={() => setCancelPhase('idle')}>
          <h3 className="text-base font-bold text-gray-900">환불 규정 안내</h3>
          <div className="mt-4 rounded-[var(--radius-md)] bg-gray-50 p-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">결제 금액</span>
              <span className="font-medium text-gray-900">
                {formatFee(paidAmount ?? 0)}
              </span>
            </div>
            <div className="mt-2 flex justify-between text-sm">
              <span className="text-gray-500">환불 비율</span>
              <span className="font-medium text-gray-900">
                {refundInfo.refundRate}%
              </span>
            </div>
            <div className="mt-2 border-t border-gray-200 pt-2 flex justify-between text-sm">
              <span className="font-medium text-gray-700">환불 예정 금액</span>
              <span className="font-bold text-primary-600">
                {formatFee(refundInfo.refundAmount)}
              </span>
            </div>
          </div>
          {refundInfo.refundRate === 0 && (
            <p className="mt-3 text-xs text-warning text-center">
              환불 불가 기간입니다. 취소 시 환불 금액이 없습니다.
            </p>
          )}
          <div className="mt-4 text-xs text-gray-400 text-center">
            모임 3일 전: 100% · 2일 전: 50% · 전날/당일: 0%
          </div>
          <div className="mt-5 flex gap-2">
            <button
              onClick={() => setCancelPhase('idle')}
              className="flex-1 rounded-[var(--radius-md)] border border-gray-200 bg-white py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              닫기
            </button>
            <button
              onClick={() => setCancelPhase('confirm')}
              className="flex-1 rounded-[var(--radius-md)] bg-gray-900 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
            >
              취소 진행
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* === Cancel Confirm Modal (Phase 2) === */}
      {cancelPhase === 'confirm' && refundInfo && (
        <ModalOverlay onClose={() => setCancelPhase('info')}>
          <h3 className="text-base font-bold text-gray-900 text-center">
            취소를 확정하시겠습니까?
          </h3>
          <p className="mt-3 text-sm text-gray-500 text-center">
            환불 금액:{' '}
            <span className="font-bold text-gray-900">
              {formatFee(refundInfo.refundAmount)}
            </span>
            {refundInfo.refundRate < 100 && (
              <span className="text-gray-400">
                {' '}
                ({refundInfo.refundRate}%)
              </span>
            )}
          </p>
          {refundInfo.refundAmount === 0 && (
            <p className="mt-1 text-xs text-warning text-center">
              환불 금액이 0원입니다. 그래도 취소하시겠습니까?
            </p>
          )}
          <div className="mt-5 flex gap-2">
            <button
              onClick={() => setCancelPhase('info')}
              className="flex-1 rounded-[var(--radius-md)] border border-gray-200 bg-white py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              돌아가기
            </button>
            <button
              onClick={handleCancelConfirm}
              className="flex-1 rounded-[var(--radius-md)] bg-error py-2.5 text-sm font-semibold text-white transition-colors hover:bg-error/90"
            >
              취소 확정
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* === Cancel Processing Modal (Phase 3) === */}
      {cancelPhase === 'processing' && (
        <ModalOverlay>
          <div className="flex flex-col items-center py-4">
            <Spinner />
            <p className="mt-3 text-sm text-gray-500">취소 처리 중...</p>
          </div>
        </ModalOverlay>
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

// --- Sub-components ---

function ModalOverlay({
  children,
  onClose,
}: {
  children: React.ReactNode
  onClose?: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="relative w-full max-w-sm rounded-[var(--radius-lg)] bg-white p-5 shadow-xl">
        {children}
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <svg
      className="h-5 w-5 animate-spin text-current"
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
  )
}
