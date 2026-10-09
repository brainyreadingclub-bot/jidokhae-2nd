'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ModalOverlay from '@/components/ui/ModalOverlay'
import { formatFee } from '@/lib/kst'

type Props = {
  meetingId: string
  meetingStatus: string
  /** 삭제 시 돌려줄 돈이 있는 사람 수 — 기준은 admin/meetings/[id]/page.tsx 주석 */
  refundCount: number
  /** 그 사람들이 낸 금액 합 */
  refundAmount: number
  /** 그중 계좌이체 — 자동 환불이 아니라 운영자가 직접 이체해야 한다 */
  refundTransferCount: number
}

/** 확인 창에서 직접 입력해야 하는 낱말 — 신청자 전액 환불이 함께 일어나는 되돌릴 수 없는 동작이라 (2026-10-09 시안 C) */
const CONFIRM_WORD = '삭제'

type DeletePhase = 'idle' | 'confirm' | 'processing' | 'partial'

export default function DeleteMeetingButton({
  meetingId,
  meetingStatus,
  refundCount,
  refundAmount,
  refundTransferCount,
}: Props) {
  const router = useRouter()
  const [hadPartial, setHadPartial] = useState(meetingStatus === 'deleting')
  const [phase, setPhase] = useState<DeletePhase>(
    meetingStatus === 'deleting' ? 'partial' : 'idle',
  )
  const [error, setError] = useState<string | null>(null)
  const [typed, setTyped] = useState('')
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
            {refundCount > 0 ? '환불 처리 중...' : '삭제 중...'}
          </p>
        </div>
      </ModalOverlay>
    )
  }

  // === Confirm dialog (modal) ===
  if (phase === 'confirm') {
    const close = () => {
      setTyped('')
      setPhase(fallbackPhase)
    }
    const ok = typed.trim() === CONFIRM_WORD
    return (
      <ModalOverlay onClose={close}>
        <h3 className="text-[17px] font-extrabold tracking-tight text-neutral-900">
          이 모임을 삭제할까요?
        </h3>
        <p className="mt-2.5 text-sm leading-relaxed text-neutral-700">
          {refundCount > 0 ? (
            <>
              신청자 <b className="text-neutral-900">{refundCount}명</b>에게 참가비가{' '}
              <b className="text-neutral-900">전액 환불</b>돼요. 삭제한 모임은 되돌릴 수 없어요.
            </>
          ) : (
            '신청자가 없어요. 삭제한 모임은 되돌릴 수 없어요.'
          )}
        </p>
        {refundCount > 0 && (
          <div className="mt-3.5 flex justify-between rounded-[12px] bg-surface-200 px-3.5 py-3 text-[13px] text-neutral-700">
            <span>환불할 금액</span>
            <b className="text-neutral-900">{formatFee(refundAmount)}</b>
          </div>
        )}
        {refundTransferCount > 0 && (
          <p className="mt-2 text-xs leading-relaxed text-neutral-600">
            그중 계좌이체 {refundTransferCount}명은 자동 환불이 안 돼요 — 직접 이체해 주세요.
          </p>
        )}
        <div className="mt-4">
          <label htmlFor="delete-confirm" className="mb-1.5 block text-xs font-bold text-neutral-800">
            확인을 위해 「{CONFIRM_WORD}」라고 입력해 주세요
          </label>
          <input
            id="delete-confirm"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            className="w-full rounded-[10px] border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:outline-none"
          />
        </div>
        <div className="mt-5 flex gap-2">
          <button
            onClick={close}
            className="h-11 flex-1 rounded-[var(--radius-md)] border border-surface-300 bg-white text-sm font-bold text-primary-700 transition-colors hover:bg-surface-100"
          >
            취소
          </button>
          <button
            onClick={() => {
              setTyped('')
              handleDelete()
            }}
            disabled={!ok}
            className="h-11 flex-1 rounded-[var(--radius-md)] bg-error text-sm font-bold text-white transition-colors hover:bg-error/90 disabled:bg-neutral-200 disabled:text-neutral-500"
          >
            {refundCount > 0 ? '삭제하고 환불하기' : '삭제하기'}
          </button>
        </div>
      </ModalOverlay>
    )
  }

  // === Default idle state ===
  return (
    <div className="flex-none">
      <button
        onClick={() => setPhase('confirm')}
        className="h-11 w-full rounded-[var(--radius-md)] border border-error bg-white px-5 text-sm font-bold text-error transition-colors hover:bg-error/5 lg:w-auto"
      >
        모임 삭제
      </button>
      {error && (
        <p className="mt-1.5 text-xs text-error font-medium">{error}</p>
      )}
    </div>
  )
}
