'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ModalOverlay from '@/components/ui/ModalOverlay'

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
  const [hadPartial, setHadPartial] = useState(meetingStatus === 'deleting')
  const [phase, setPhase] = useState<DeletePhase>(
    meetingStatus === 'deleting' ? 'partial' : 'idle',
  )
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    refundedCount: number
    failedCount: number
  } | null>(null)

  const fallbackPhase = hadPartial ? 'partial' : 'idle'

  async function handleDelete() {
    setPhase('processing')
    setError(null)
    setHadPartial(true)

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

  // === Partial failure / retry state (modal) ===
  if (phase === 'partial') {
    return (
      <ModalOverlay>
        <h3 className="text-base font-semibold text-primary-900 text-center">환불 실패</h3>
        <p className="mt-3 text-sm text-primary-600/70 text-center">
          {result ? (
            <>{result.failedCount}건의 환불이 실패했습니다.<br />재시도하시겠습니까?</>
          ) : (
            '일부 환불이 실패했습니다.'
          )}
        </p>
        {error && (
          <p className="mt-2 text-xs text-error text-center font-medium">{error}</p>
        )}
        <div className="mt-5 flex gap-2">
          <button
            onClick={() => {
              setPhase('idle')
              setHadPartial(false)
            }}
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
            onClick={handleDelete}
            className="flex-1 rounded-[var(--radius-md)] bg-warning py-2.5 text-sm font-bold text-white transition-colors hover:bg-warning/90"
          >
            재시도
          </button>
        </div>
      </ModalOverlay>
    )
  }

  // === Processing state (modal) ===
  if (phase === 'processing') {
    return (
      <ModalOverlay>
        <div className="flex flex-col items-center py-4">
          <svg
            className="h-6 w-6 animate-spin text-primary-400 mb-3"
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
          <p className="text-sm font-medium text-primary-700">
            {confirmedCount > 0 ? '환불 처리 중...' : '삭제 중...'}
          </p>
        </div>
      </ModalOverlay>
    )
  }

  // === Confirm dialog (modal) ===
  if (phase === 'confirm') {
    return (
      <ModalOverlay onClose={() => setPhase(fallbackPhase)}>
        <h3 className="text-base font-semibold text-primary-900 text-center">모임 삭제</h3>
        <p className="mt-3 text-sm text-primary-600/70 text-center">
          {confirmedCount > 0 ? (
            <>
              신청자 <span className="font-bold text-primary-800">{confirmedCount}명</span>에게
              <br />
              <span className="font-bold text-error">100% 환불</span>됩니다.
              <br />
              삭제하시겠습니까?
            </>
          ) : (
            '신청자가 없습니다. 삭제하시겠습니까?'
          )}
        </p>
        <div className="mt-5 flex gap-2">
          <button
            onClick={() => setPhase(fallbackPhase)}
            className="flex-1 rounded-[var(--radius-md)] py-2.5 text-sm font-medium transition-colors hover:bg-primary-50"
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
            className="flex-1 rounded-[var(--radius-md)] bg-error py-2.5 text-sm font-bold text-white transition-colors hover:bg-error/90"
          >
            삭제 확정
          </button>
        </div>
      </ModalOverlay>
    )
  }

  // === Default idle state ===
  return (
    <div>
      <button
        onClick={() => setPhase('confirm')}
        className="w-full py-2.5 text-caption font-normal text-neutral-400 transition-colors hover:text-red-500"
      >
        삭제
      </button>
      {error && (
        <p className="mt-1.5 text-xs text-error text-center font-medium">{error}</p>
      )}
    </div>
  )
}
