'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  meetingId: string
  meetingStatus: string
  confirmedCount: number
}

type DeletePhase = 'idle' | 'confirm' | 'processing' | 'partial'

export default function DeleteMeetingButton({
  meetingId,
  meetingStatus,
  confirmedCount,
}: Props) {
  const router = useRouter()
  // Track if we've ever entered partial failure state (meeting is now 'deleting' in DB)
  const [hadPartial, setHadPartial] = useState(meetingStatus === 'deleting')
  const [phase, setPhase] = useState<DeletePhase>(
    meetingStatus === 'deleting' ? 'partial' : 'idle',
  )
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    refundedCount: number
    failedCount: number
  } | null>(null)

  // After any delete attempt, meeting is at least 'deleting' in DB
  const fallbackPhase = hadPartial ? 'partial' : 'idle'

  async function handleDelete() {
    setPhase('processing')
    setError(null)
    setHadPartial(true) // meeting is now 'deleting' in DB after first attempt

    try {
      const res = await fetch(`/api/meetings/${meetingId}/delete`, {
        method: 'POST',
      })
      const data = await res.json()

      if (data.status === 'success') {
        router.push('/admin')
        router.refresh()
      } else if (data.status === 'partial') {
        setResult({
          refundedCount: data.refundedCount,
          failedCount: data.failedCount,
        })
        setPhase('partial')
      } else {
        setError(data.message || '삭제에 실패했습니다')
        setPhase(fallbackPhase)
      }
    } catch {
      setError('네트워크 오류가 발생했습니다')
      setPhase(fallbackPhase)
    }
  }

  // === Partial failure / retry state ===
  if (phase === 'partial') {
    return (
      <div>
        <button
          onClick={() => setPhase('confirm')}
          className="w-full rounded-[var(--radius-md)] border border-warning/30 bg-accent-50 py-2.5 text-sm font-bold text-warning transition-colors hover:bg-accent-100"
        >
          환불 재시도
        </button>
        {result && (
          <p className="mt-1.5 text-xs text-warning text-center font-medium">
            {result.failedCount}건 환불 실패
          </p>
        )}
        {error && (
          <p className="mt-1.5 text-xs text-error text-center font-medium">{error}</p>
        )}
      </div>
    )
  }

  // === Processing state ===
  if (phase === 'processing') {
    return (
      <div>
        <button
          disabled
          className="w-full rounded-[var(--radius-md)] py-2.5 text-sm cursor-not-allowed"
          style={{
            backgroundColor: 'var(--color-surface-200)',
            color: 'var(--color-primary-300)',
          }}
        >
          <span className="inline-flex items-center gap-1.5">
            <svg
              className="h-3.5 w-3.5 animate-spin"
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
            {confirmedCount > 0 ? '환불 처리 중...' : '삭제 중...'}
          </span>
        </button>
      </div>
    )
  }

  // === Confirm dialog (modal) ===
  if (phase === 'confirm') {
    return (
      <div>
        <div
          className="rounded-[var(--radius-md)] border border-error/20 p-3"
          style={{ backgroundColor: 'rgba(196, 61, 61, 0.04)' }}
        >
          <p className="text-sm text-primary-700 text-center">
            {confirmedCount > 0 ? (
              <>
                신청자 <span className="font-bold">{confirmedCount}명</span>에게
                <br />
                <span className="font-bold text-error">100% 환불</span>됩니다.
                삭제하시겠습니까?
              </>
            ) : (
              '이 모임을 삭제하시겠습니까?'
            )}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setPhase(fallbackPhase)}
              className="flex-1 rounded-[var(--radius-md)] py-2 text-xs font-medium transition-colors hover:bg-primary-50"
              style={{
                backgroundColor: 'var(--color-surface-50)',
                border: '1px solid var(--color-surface-300)',
                color: 'var(--color-primary-600)',
              }}
            >
              취소
            </button>
            <button
              onClick={handleDelete}
              className="flex-1 rounded-[var(--radius-md)] bg-error py-2 text-xs font-bold text-white transition-colors hover:bg-error/90"
            >
              삭제 확정
            </button>
          </div>
        </div>
      </div>
    )
  }

  // === Default idle state ===
  return (
    <div>
      <button
        onClick={() => setPhase('confirm')}
        className="w-full rounded-[var(--radius-md)] border border-error/30 py-2.5 text-sm font-bold text-error transition-colors hover:bg-error/5 active:bg-error/10"
        style={{ backgroundColor: 'var(--color-surface-50)' }}
      >
        삭제
      </button>
      {error && (
        <p className="mt-1.5 text-xs text-error text-center font-medium">{error}</p>
      )}
    </div>
  )
}
