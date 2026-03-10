'use client'

import { useState } from 'react'
import type { ButtonState } from '@/lib/kst'

type Props = {
  buttonState: ButtonState
}

export default function MeetingActionButton({ buttonState }: Props) {
  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  return (
    <>
      {buttonState.type === 'register' && (
        <button
          onClick={() => showToast('결제 기능 준비 중입니다')}
          className="w-full rounded-[var(--radius-md)] bg-primary-500 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-primary-600 active:bg-primary-700"
        >
          신청하기
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
