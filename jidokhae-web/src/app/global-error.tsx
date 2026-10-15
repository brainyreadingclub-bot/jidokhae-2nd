'use client'

import { useEffect } from 'react'
import './globals.css'

/**
 * 앱 전체의 마지막 오류 경계.
 * 라우트 그룹 오류 화면((next)·(main)·(admin) error.tsx) 밖에서 난 오류 —
 * 로그인(`auth/*`)·정책(`policy/*`) 화면과 루트 레이아웃 — 를 받는다.
 * 없으면 Next.js 기본 영문 오류 화면이 나간다 (2026-10-14 코드 조사 §2 오류 화면).
 * 루트 레이아웃을 대신하므로 html·body를 직접 그린다. 모양은 `(next)/error.tsx`와 같다.
 */
export default function GlobalError({
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
    <html lang="ko">
      <body className="bg-white text-tg-900">
        <div className="flex min-h-dvh flex-col items-center justify-center px-5 text-center">
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
      </body>
    </html>
  )
}
