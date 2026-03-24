import Link from 'next/link'
import { getSiteSettings } from '@/lib/site-settings'

export default async function Footer() {
  const settings = await getSiteSettings()

  const companyName = settings['company_name'] ?? '지독해'
  const representative = settings['representative'] ?? '임재윤'
  const businessNumber = settings['business_number'] ?? '494-42-01276'
  const address = settings['address'] ?? '경상북도 경주시 태종로 801-11 (황오동) 208호'
  const phone = settings['phone'] ?? '0507-1396-7908'

  return (
    <footer
      className="border-t border-surface-300 px-5 py-6 text-small text-neutral-400"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 8px)' }}
    >
      <div className="space-y-1.5">
        <p>상호명: {companyName} | 대표자: {representative}</p>
        <p>사업자등록번호: {businessNumber}</p>
        <p>주소: {address}</p>
        <p>연락처: {phone}</p>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link
          href="/policy/terms"
          className="text-primary-600 hover:text-primary-700 underline"
        >
          이용약관
        </Link>
        <span>|</span>
        <Link
          href="/policy/privacy"
          className="text-primary-600 hover:text-primary-700 underline"
        >
          개인정보처리방침
        </Link>
        <span>|</span>
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
      <p className="mt-3">&copy; 2026 {companyName}</p>
    </footer>
  )
}
