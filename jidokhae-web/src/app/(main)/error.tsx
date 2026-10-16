'use client'

import { useEffect } from 'react'
import ErrorFeedbackLink from '@/components/next/ErrorFeedbackLink'

/**
 * `(main)` 라우트 그룹 에러 경계 — `(next)/error.tsx`와 같은 모양으로 맞췄다 (2026-10-14 화면 점검 30번).
 * 개발용 오류 문구(예: 「모임 목록 조회 실패: …」)는 화면에 그리지 않고 콘솔로만 남긴다.
 */
export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[MainError]', error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-5 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-tg-100 text-[22px]" aria-hidden>
        😵
      </div>
      <h2 className="mt-4 text-[17px] font-extrabold tracking-tight text-tg-900">
        화면을 불러오지 못했어요
      </h2>
      <p className="mt-1.5 text-[13px] text-tg-600">잠깐 뒤에 다시 시도해 주세요</p>
      <button
        type="button"
        onClick={reset}
        className="mt-5 flex min-h-[48px] min-w-[160px] items-center justify-center rounded-[14px] bg-brand px-6 text-sm font-bold text-white"
      >
        다시 시도
      </button>
      <ErrorFeedbackLink />
    </div>
  )
}
