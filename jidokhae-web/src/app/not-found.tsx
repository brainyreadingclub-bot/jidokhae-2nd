import Link from 'next/link'

/**
 * 없는 주소(어느 라우트 그룹에도 안 걸리는 URL)의 404.
 * 없으면 Next.js 기본 영문 화면("This page could not be found.")이 나간다 (2026-10-13 화면 점검 31번).
 * 라우트 그룹 레이아웃 밖이라 머리글을 여기서 직접 그린다 — `(next)/layout.tsx` 머리글과 같은 모양.
 */
export default function NotFound() {
  return (
    <div className="min-h-dvh bg-white text-tg-900">
      <header className="mx-auto flex h-12 max-w-screen-sm items-center pl-5 pr-2">
        <Link href="/home" className="text-[17px] font-extrabold tracking-tight text-brand-deep">
          지독해
        </Link>
      </header>
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-5 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-tg-100 text-[22px]" aria-hidden>
          🔍
        </div>
        <h2 className="mt-4 text-[17px] font-extrabold tracking-tight text-tg-900">
          찾는 화면이 없어요
        </h2>
        <p className="mt-1.5 text-[13px] text-tg-600">주소가 바뀌었거나 없어진 화면이에요</p>
        <Link
          href="/home"
          className="mt-5 flex min-h-[48px] min-w-[160px] items-center justify-center rounded-[14px] bg-brand px-6 text-sm font-bold text-white"
        >
          홈으로
        </Link>
      </div>
    </div>
  )
}
