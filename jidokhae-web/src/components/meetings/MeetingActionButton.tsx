'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { loadTossPayments } from '@tosspayments/payment-sdk'
import type { ButtonState } from '@/lib/kst'
import { formatFee } from '@/lib/kst'
import { calculateRefund, getRefundRuleText } from '@/lib/refund'
import ModalOverlay from '@/components/ui/ModalOverlay'

type Props = {
  buttonState: ButtonState
  meetingId: string
  meetingTitle: string
  meetingFee: number
  meetingDate: string
  userId: string
  registrationId?: string
  paidAmount?: number | null
  waitlistRegistrationId?: string
  waitlistPaidAmount?: number | null
}

type CancelPhase = 'idle' | 'info' | 'confirm' | 'processing' | 'complete'
type WaitlistCancelPhase = 'idle' | 'confirm' | 'processing' | 'complete'

export default function MeetingActionButton({
  buttonState,
  meetingId,
  meetingTitle,
  meetingFee,
  meetingDate,
  userId,
  registrationId,
  paidAmount,
  waitlistRegistrationId,
  waitlistPaidAmount,
}: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [cancelPhase, setCancelPhase] = useState<CancelPhase>('idle')
  const [cancelResult, setCancelResult] = useState<{
    refundedAmount: number
    refundRate: number
  } | null>(null)
  const [waitlistCancelPhase, setWaitlistCancelPhase] = useState<WaitlistCancelPhase>('idle')

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

  async function handleWaitlistCancelConfirm() {
    if (!waitlistRegistrationId) return
    setWaitlistCancelPhase('processing')

    try {
      const res = await fetch('/api/registrations/waitlist-cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationId: waitlistRegistrationId }),
      })

      const data = await res.json()

      if (data.status === 'success') {
        setWaitlistCancelPhase('complete')
        router.refresh()
      } else {
        setWaitlistCancelPhase('idle')
        showToast(data.message || '대기 취소에 실패했습니다')
      }
    } catch {
      setWaitlistCancelPhase('idle')
      showToast('네트워크 오류가 발생했습니다')
    }
  }

  // Determine if we should show a sticky button
  const showStickyButton =
    (buttonState.type === 'register') ||
    (buttonState.type === 'full') ||
    (buttonState.type === 'cancel' && cancelPhase === 'idle') ||
    (buttonState.type === 'join_waitlist') ||
    (buttonState.type === 'waitlist_cancel' && waitlistCancelPhase === 'idle')

  return (
    <>
      {/* === Sticky bottom buttons === */}
      {showStickyButton && (
        <StickyBottom>
          {buttonState.type === 'register' && (
            <button
              onClick={handleRegister}
              disabled={loading}
              className="w-full rounded-[var(--radius-lg)] bg-primary-600 py-4 text-sm font-bold text-white tracking-wide transition-all hover:bg-primary-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ boxShadow: '0 4px 14px rgba(27, 67, 50, 0.25)' }}
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

          {buttonState.type === 'full' && (
            <button
              disabled
              className="w-full rounded-[var(--radius-lg)] py-4 text-sm font-bold cursor-not-allowed"
              style={{
                backgroundColor: 'var(--color-surface-200)',
                color: 'var(--color-primary-300)',
              }}
            >
              마감
            </button>
          )}

          {buttonState.type === 'cancel' && cancelPhase === 'idle' && (
            <button
              onClick={() => setCancelPhase('info')}
              className="w-full rounded-[var(--radius-lg)] py-4 text-sm font-bold transition-all hover:bg-primary-50 active:scale-[0.98]"
              style={{
                backgroundColor: 'var(--color-surface-50)',
                border: '1px solid var(--color-surface-300)',
                color: 'var(--color-primary-600)',
              }}
            >
              취소하기
            </button>
          )}

          {buttonState.type === 'join_waitlist' && (
            <div>
              <button
                onClick={handleRegister}
                disabled={loading}
                className="w-full rounded-[var(--radius-lg)] bg-accent-500 py-4 text-sm font-bold text-white tracking-wide transition-all hover:bg-accent-600 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ boxShadow: '0 4px 14px rgba(180, 100, 60, 0.25)' }}
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <Spinner />
                    결제 진행 중...
                  </span>
                ) : (
                  '대기 신청하기'
                )}
              </button>
              <p className="mt-2 text-center text-xs text-primary-400 leading-relaxed">
                취소자 발생 시 자동으로 참여가 확정됩니다.
                <br />
                모임 전날까지 승격되지 않으면 자동 전액 환불됩니다.
              </p>
            </div>
          )}

          {buttonState.type === 'waitlist_cancel' && waitlistCancelPhase === 'idle' && (
            <button
              onClick={() => setWaitlistCancelPhase('confirm')}
              className="w-full rounded-[var(--radius-lg)] py-4 text-sm font-bold transition-all hover:bg-primary-50 active:scale-[0.98]"
              style={{
                backgroundColor: 'var(--color-surface-50)',
                border: '1px solid var(--color-surface-300)',
                color: 'var(--color-primary-600)',
              }}
            >
              대기 취소하기
            </button>
          )}
        </StickyBottom>
      )}

      {/* === Cancel complete (replaces button area) === */}
      {cancelPhase === 'complete' && cancelResult && (
        <div
          className="mt-8 rounded-[var(--radius-lg)] p-6 text-center"
          style={{
            backgroundColor: 'var(--color-surface-50)',
            border: '1px solid var(--color-surface-300)',
          }}
        >
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-50">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-primary-600"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h3 className="text-base font-bold text-primary-900">취소 완료</h3>
          <p className="mt-2 text-sm text-primary-600/70">
            {cancelResult.refundedAmount > 0 ? (
              <>
                환불 예정 금액:{' '}
                <span className="font-bold text-primary-800">
                  {formatFee(cancelResult.refundedAmount)}
                </span>
                <br />
                <span className="text-xs text-primary-400">
                  영업일 기준 3~5일 내 환불됩니다
                </span>
              </>
            ) : (
              '환불 불가 기간으로 환불 금액이 없습니다'
            )}
          </p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 w-full rounded-[var(--radius-lg)] bg-primary-600 py-3.5 text-sm font-bold text-white transition-all hover:bg-primary-700 active:scale-[0.98]"
          >
            모임 일정으로
          </button>
        </div>
      )}

      {/* === Waitlist info card === */}
      {buttonState.type === 'waitlist_cancel' && waitlistCancelPhase === 'idle' && (
        <div
          className="mt-8 rounded-[var(--radius-lg)] p-5"
          style={{
            backgroundColor: 'var(--color-surface-50)',
            border: '1px solid var(--color-accent-200)',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="inline-flex items-center rounded-full bg-accent-50 px-2.5 py-0.5 text-[11px] font-bold text-accent-700 border border-accent-200">
              대기 중
            </span>
            {waitlistPaidAmount != null && (
              <span className="text-sm font-bold text-primary-800">
                {formatFee(waitlistPaidAmount)}원
              </span>
            )}
          </div>
          <p className="text-xs text-primary-500 leading-relaxed">
            자리가 나면 자동으로 참여가 확정됩니다.
            <br />
            모임 전날까지 승격되지 않으면 자동 전액 환불됩니다.
          </p>
        </div>
      )}

      {/* === Waitlist cancel complete === */}
      {waitlistCancelPhase === 'complete' && (
        <div
          className="mt-8 rounded-[var(--radius-lg)] p-6 text-center"
          style={{
            backgroundColor: 'var(--color-surface-50)',
            border: '1px solid var(--color-surface-300)',
          }}
        >
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-50">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-primary-600"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h3 className="text-base font-bold text-primary-900">대기 취소 완료</h3>
          <p className="mt-2 text-sm text-primary-600/70">
            결제 금액이 전액 환불됩니다.
            <br />
            <span className="text-xs text-primary-400">
              영업일 기준 3~5일 내 환불됩니다
            </span>
          </p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 w-full rounded-[var(--radius-lg)] bg-primary-600 py-3.5 text-sm font-bold text-white transition-all hover:bg-primary-700 active:scale-[0.98]"
          >
            모임 일정으로
          </button>
        </div>
      )}

      {/* === Attended === */}
      {buttonState.type === 'attended' && (
        <div
          className="mt-8 w-full rounded-[var(--radius-lg)] bg-primary-50 py-4 text-center text-sm font-bold text-primary-700"
          style={{ border: '1px solid var(--color-primary-100)' }}
        >
          참여 완료
        </div>
      )}

      {/* === Cancel Info Modal (Phase 1) === */}
      {cancelPhase === 'info' && refundInfo && (
        <ModalOverlay onClose={() => setCancelPhase('idle')}>
          <h3 className="text-base font-bold text-primary-900">환불 규정 안내</h3>
          <div
            className="mt-4 rounded-[var(--radius-md)] p-4"
            style={{
              backgroundColor: 'var(--color-surface-100)',
              border: '1px solid var(--color-surface-300)',
            }}
          >
            <div className="flex justify-between text-sm">
              <span className="text-primary-500">결제 금액</span>
              <span className="font-semibold text-primary-800">
                {formatFee(paidAmount ?? 0)}
              </span>
            </div>
            <div className="mt-2 flex justify-between text-sm">
              <span className="text-primary-500">환불 비율</span>
              <span className="font-semibold text-primary-800">
                {refundInfo.refundRate}%
              </span>
            </div>
            <div
              className="mt-2 pt-2 flex justify-between text-sm"
              style={{ borderTop: '1px solid var(--color-surface-300)' }}
            >
              <span className="font-semibold text-primary-700">환불 예정 금액</span>
              <span className="font-bold text-accent-600">
                {formatFee(refundInfo.refundAmount)}
              </span>
            </div>
          </div>
          {refundInfo.refundRate === 0 && (
            <p className="mt-3 text-xs text-warning text-center font-medium">
              환불 불가 기간입니다. 취소 시 환불 금액이 없습니다.
            </p>
          )}
          <div className="mt-4 text-xs text-primary-400 text-center">
            {getRefundRuleText()}
          </div>
          <div className="mt-5 flex gap-2">
            <button
              onClick={() => setCancelPhase('idle')}
              className="flex-1 rounded-[var(--radius-md)] py-2.5 text-sm font-medium transition-colors hover:bg-primary-50"
              style={{
                backgroundColor: 'var(--color-surface-50)',
                border: '1px solid var(--color-surface-300)',
                color: 'var(--color-primary-600)',
              }}
            >
              닫기
            </button>
            <button
              onClick={() => setCancelPhase('confirm')}
              className="flex-1 rounded-[var(--radius-md)] bg-primary-700 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-800"
            >
              취소 진행
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* === Cancel Confirm Modal (Phase 2) === */}
      {cancelPhase === 'confirm' && refundInfo && (
        <ModalOverlay onClose={() => setCancelPhase('info')}>
          <h3 className="text-base font-bold text-primary-900 text-center">
            취소를 확정하시겠습니까?
          </h3>
          <p className="mt-3 text-sm text-primary-600/70 text-center">
            환불 금액:{' '}
            <span className="font-bold text-primary-800">
              {formatFee(refundInfo.refundAmount)}
            </span>
            {refundInfo.refundRate < 100 && (
              <span className="text-primary-400">
                {' '}
                ({refundInfo.refundRate}%)
              </span>
            )}
          </p>
          {refundInfo.refundAmount === 0 && (
            <p className="mt-1 text-xs text-warning text-center font-medium">
              환불 금액이 0원입니다. 그래도 취소하시겠습니까?
            </p>
          )}
          <div className="mt-5 flex gap-2">
            <button
              onClick={() => setCancelPhase('info')}
              className="flex-1 rounded-[var(--radius-md)] py-2.5 text-sm font-medium transition-colors hover:bg-primary-50"
              style={{
                backgroundColor: 'var(--color-surface-50)',
                border: '1px solid var(--color-surface-300)',
                color: 'var(--color-primary-600)',
              }}
            >
              돌아가기
            </button>
            <button
              onClick={handleCancelConfirm}
              className="flex-1 rounded-[var(--radius-md)] bg-error py-2.5 text-sm font-bold text-white transition-colors hover:bg-error/90"
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
            <p className="mt-3 text-sm text-primary-500">취소 처리 중...</p>
          </div>
        </ModalOverlay>
      )}

      {/* === Waitlist Cancel Confirm Modal === */}
      {waitlistCancelPhase === 'confirm' && (
        <ModalOverlay onClose={() => setWaitlistCancelPhase('idle')}>
          <h3 className="text-base font-bold text-primary-900 text-center">
            대기를 취소하시겠습니까?
          </h3>
          <p className="mt-3 text-sm text-primary-600/70 text-center">
            결제 금액이 전액 환불됩니다.
          </p>
          <div className="mt-5 flex gap-2">
            <button
              onClick={() => setWaitlistCancelPhase('idle')}
              className="flex-1 rounded-[var(--radius-md)] py-2.5 text-sm font-medium transition-colors hover:bg-primary-50"
              style={{
                backgroundColor: 'var(--color-surface-50)',
                border: '1px solid var(--color-surface-300)',
                color: 'var(--color-primary-600)',
              }}
            >
              닫기
            </button>
            <button
              onClick={handleWaitlistCancelConfirm}
              className="flex-1 rounded-[var(--radius-md)] bg-error py-2.5 text-sm font-bold text-white transition-colors hover:bg-error/90"
            >
              대기 취소
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* === Waitlist Cancel Processing Modal === */}
      {waitlistCancelPhase === 'processing' && (
        <ModalOverlay>
          <div className="flex flex-col items-center py-4">
            <Spinner />
            <p className="mt-3 text-sm text-primary-500">대기 취소 처리 중...</p>
          </div>
        </ModalOverlay>
      )}

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full px-5 py-2.5 text-sm font-medium text-white animate-[fadeIn_0.2s_ease-out]"
          style={{
            backgroundColor: 'var(--color-primary-800)',
            boxShadow: 'var(--shadow-elevated)',
          }}
        >
          {toast}
        </div>
      )}
    </>
  )
}

// --- Sub-components ---

function StickyBottom({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40"
      style={{ paddingBottom: 'calc(64px + env(safe-area-inset-bottom, 0px))' }}
    >
      <div
        className="mx-auto max-w-screen-sm px-5 py-3"
        style={{
          backgroundColor: 'var(--color-surface-50)',
          boxShadow: '0 -2px 8px rgba(45, 90, 61, 0.06)',
        }}
      >
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
