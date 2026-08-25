'use client'

import { useEffect } from 'react'

/**
 * `(next)` 라우트 그룹 에러 경계.
 * 없으면 Supabase 쿼리 하나가 던질 때 회원에게 **스킨 없는 Next.js 기본 에러 화면**이 나간다.
 * `(main)`·`(admin)`은 이미 있었고 여기만 없었다 (2026-08-25 조사 §2-4).
 */
export default function NextError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
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
    </div>
  )
}
