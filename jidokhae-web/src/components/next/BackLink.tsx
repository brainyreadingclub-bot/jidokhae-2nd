import Link from 'next/link'

/**
 * 토스 스킨 뒤로 가기 — **라벨과 도착지를 반드시 맞춘다.**
 * 구 화면의 "목록으로"·"모임 일정으로"가 전부 `/`(→ `/home`)로 가서
 * 모임 목록을 눌렀는데 홈이 나오는 상태였다 (2026-08-25 조사 §2-3).
 */
export default function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="-ml-1 inline-flex min-h-[44px] items-center gap-2 text-[17px] font-extrabold tracking-tight text-tg-900"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M19 12H5" />
        <polyline points="11 18 5 12 11 6" />
      </svg>
      {label}
    </Link>
  )
}
