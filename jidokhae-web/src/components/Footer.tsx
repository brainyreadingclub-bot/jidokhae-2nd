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
      className="border-t border-surface-300 px-5 py-4"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 8px)' }}
    >
      <div className="flex flex-wrap items-center gap-3 text-small">
        <Link
          href="/policy/meetings"
          className="text-primary-600 hover:text-primary-700 underline"
        >
          모임 일정
        </Link>
        <span className="text-neutral-300">|</span>
        <Link
          href="/policy/terms"
          className="text-primary-600 hover:text-primary-700 underline"
        >
          이용약관
        </Link>
        <span className="text-neutral-300">|</span>
        <Link
          href="/policy/privacy"
          className="text-primary-600 hover:text-primary-700 underline"
        >
          개인정보처리방침
        </Link>
        <span className="text-neutral-300">|</span>
        <Link
          href="/policy/refund"
          className="text-primary-600 hover:text-primary-700 underline"
        >
          환불정책
        </Link>
        <span className="text-neutral-300">|</span>
        <Link
          href="/policy/about"
          className="text-primary-600 hover:text-primary-700 underline"
        >
          서비스 소개
        </Link>
      </div>
      <div className="mt-3 text-[11px] text-neutral-400 leading-relaxed">
        <p>{companyName} | 대표 {representative} | 사업자등록번호 {businessNumber} (간이과세자)</p>
        <p>{address} | {phone}</p>
      </div>
      <p className="mt-2 text-[11px] text-neutral-400">&copy; 2026 {companyName}</p>
    </footer>
  )
}
