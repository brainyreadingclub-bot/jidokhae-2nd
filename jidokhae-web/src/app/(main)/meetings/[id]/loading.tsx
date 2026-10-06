import Link from 'next/link'

/**
 * 로딩 fallback은 플래그를 못 읽는다 (여기서 await하면 fallback 자체가 늦게 뜬다).
 * /meet은 양쪽에서 다 모임 목록에 도착한다 — ON이면 모임 탭, OFF면 (next) 레이아웃이
 * /로 되돌려 구 목록. /로 두면 ON일 때 목록이 아니라 /home으로 간다.
 */
export default function MeetingDetailLoading() {
  return (
    <div className="px-5 pt-4">
      <Link
        href="/meet"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-400 hover:text-primary-600 transition-colors mb-5"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        목록으로
      </Link>
    </div>
  )
}
