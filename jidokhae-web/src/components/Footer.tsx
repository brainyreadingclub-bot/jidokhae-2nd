import Link from 'next/link'

export default function Footer() {
  return (
    <footer
      className="border-t border-surface-300 px-5 py-6 text-small text-neutral-400"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 8px)' }}
    >
      <div className="space-y-1.5">
        <p>상호명: 지독해 | 대표자: 임재윤</p>
        <p>사업자등록번호: 494-42-01276</p>
        <p>주소: 경상북도 경주시 태종로 801-11 208호</p>
        <p>연락처: 010-8470-8730</p>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Link
          href="/policy/refund"
          className="text-primary-600 hover:text-primary-700 underline"
        >
          환불정책
        </Link>
        <span>|</span>
        <Link
          href="/policy/about"
          className="text-primary-600 hover:text-primary-700 underline"
        >
          서비스 소개
        </Link>
      </div>
      <p className="mt-3">&copy; 2026 지독해</p>
    </footer>
  )
}
