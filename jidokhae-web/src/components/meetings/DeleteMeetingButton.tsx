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
  const [phase, setPhase] = useState<DeletePhase>(
    meetingStatus === 'deleting' ? 'partial' : 'idle',
  )
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    refundedCount: number
    failedCount: number
  } | null>(null)

  async function handleDelete() {
    setPhase('processing')
    setError(null)

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
        setPhase(meetingStatus === 'deleting' ? 'partial' : 'idle')
      }
    } catch {
      setError('네트워크 오류가 발생했습니다')
      setPhase(meetingStatus === 'deleting' ? 'partial' : 'idle')
    }
  }

  // === Partial failure / retry state ===
  if (phase === 'partial') {
    return (
      <div>
        <button
          onClick={() => setPhase('confirm')}
          className="w-full rounded-[var(--radius-md)] border border-warning/30 bg-warning/5 py-2.5 text-sm font-medium text-warning transition-colors hover:bg-warning/10"
        >
          환불 재시도
        </button>
        {result && (
          <p className="mt-1.5 text-xs text-warning text-center">
            {result.failedCount}건 환불 실패
          </p>
        )}
        {error && (
          <p className="mt-1.5 text-xs text-error text-center">{error}</p>
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
          className="w-full rounded-[var(--radius-md)] border border-gray-200 bg-gray-50 py-2.5 text-sm text-gray-400 cursor-not-allowed"
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
        <div className="rounded-[var(--radius-md)] border border-error/20 bg-error/5 p-3">
          <p className="text-sm text-gray-700 text-center">
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
              onClick={() =>
                setPhase(meetingStatus === 'deleting' ? 'partial' : 'idle')
              }
              className="flex-1 rounded-[var(--radius-md)] border border-gray-200 bg-white py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              취소
            </button>
            <button
              onClick={handleDelete}
              className="flex-1 rounded-[var(--radius-md)] bg-error py-2 text-xs font-semibold text-white transition-colors hover:bg-error/90"
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
        className="w-full rounded-[var(--radius-md)] border border-error/30 bg-white py-2.5 text-sm font-medium text-error transition-colors hover:bg-error/5 active:bg-error/10"
      >
        삭제
      </button>
      {error && (
        <p className="mt-1.5 text-xs text-error text-center">{error}</p>
      )}
    </div>
  )
}
