import Link from 'next/link'
import { Fragment } from 'react'
import { getSiteSettings } from '@/lib/site-settings'
import { MEMBER_POLICY_LINKS, resolveBusinessInfo } from '@/lib/legal'
import LogoutRow from '@/components/next/LogoutRow'

/**
 * 「나」 탭 본문 맨 아래 법적 블록 + 로그아웃 (2026-09-19 A2 시안 02).
 *
 * 왜 여기 한 곳인가 — 푸터를 5탭 전체에 붙이면 홈·모임·이야기·서재 네 화면 바닥에도
 * 법률 블록이 깔린다. 토스 스킨 규율이 「테두리 0 · 면과 여백으로 구분」인데
 * 구 `Footer`는 border-t + 밑줄 링크 묶음이라 네 화면을 한꺼번에 흐린다.
 *
 * 구 `components/Footer.tsx`를 통째로 쓰지 않는 이유는 **스킨이 다르기 때문**이고,
 * 사업자정보 값과 링크 목록은 `lib/legal.ts` 한 곳에서 같이 읽는다 (손으로 적지 않는다).
 */
export default async function AccountFooter() {
  const settings = await getSiteSettings()
  const { companyName, representative, businessNumber, address, phone } =
    resolveBusinessInfo(settings)

  return (
    <div className="mt-8 border-t border-tg-100 pt-[18px]">
      <div className="flex flex-wrap items-center gap-x-2 text-xs font-semibold">
        {MEMBER_POLICY_LINKS.map((link, i) => (
          <Fragment key={link.href}>
            {i > 0 && (
              <span className="text-tg-300" aria-hidden>
                ·
              </span>
            )}
            <Link
              href={link.href}
              className="text-tg-700 underline decoration-tg-300 underline-offset-2"
            >
              {link.label}
            </Link>
          </Fragment>
        ))}
      </div>

      {/* 10.5px는 토스 스킨 규율상 tg-600 이상. 숫자 두 개는 하이픈에서 끊기므로 nowrap */}
      <p className="mt-[11px] break-keep text-[10.5px] leading-[1.8] text-tg-600">
        {companyName} | 대표 {representative} |{' '}
        <span className="whitespace-nowrap">사업자등록번호 {businessNumber}</span> (간이과세자)
        <br />
        {address} | <span className="whitespace-nowrap">{phone}</span>
      </p>

      <LogoutRow />
    </div>
  )
}
