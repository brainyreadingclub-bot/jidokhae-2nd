import Link from 'next/link'

/**
 * 새 화면 안에서 `notFound()`가 불렸을 때(지워진 발제·모임 자리 모드 등).
 * 머리글·아래 탭은 `(next)/layout.tsx`가 그린다. 모임 상세는 `meet/[id]/not-found.tsx`가 따로 있다.
 */
export default function NextNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
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
  )
}
