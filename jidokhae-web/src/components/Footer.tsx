import Link from 'next/link'
import { Fragment } from 'react'
import { getSiteSettings } from '@/lib/site-settings'
import { POLICY_LINKS, resolveBusinessInfo } from '@/lib/legal'

export default async function Footer() {
  const settings = await getSiteSettings()
  const { companyName, representative, businessNumber, address, phone } =
    resolveBusinessInfo(settings)

  return (
    <footer
      className="border-t border-surface-300 px-5 py-4"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 8px)' }}
    >
      <div className="flex flex-wrap items-center gap-3 text-small">
        {POLICY_LINKS.map((link, i) => (
          <Fragment key={link.href}>
            {i > 0 && <span className="text-neutral-300">|</span>}
            <Link
              href={link.href}
              className="text-primary-600 hover:text-primary-700 underline"
            >
              {link.label}
            </Link>
          </Fragment>
        ))}
      </div>
      <div className="mt-3 text-[11px] text-neutral-400 leading-relaxed">
        <p>{companyName} | 대표 {representative} | 사업자등록번호 {businessNumber} (간이과세자)</p>
        <p>{address} | {phone}</p>
      </div>
      <p className="mt-2 text-[11px] text-neutral-400">&copy; 2026 {companyName}</p>
    </footer>
  )
}
