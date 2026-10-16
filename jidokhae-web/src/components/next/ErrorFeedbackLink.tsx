'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * 오류 화면의 「불편한 점 알려 주기」 (보관함 I-001).
 * 🔴 오류가 난 **경로만** 붙인다 — 오류 원문·digest는 회원 화면에도, 의견 글에도 싣지 않는다
 * (2026-10-14 결정 「결제 실패 화면 원문 금지」와 같은 결). 쿼리 문자열도 붙이지 않는다
 */
export default function ErrorFeedbackLink() {
  const pathname = usePathname() ?? ''
  const href = `/me/feedback?src=error&from=${encodeURIComponent(pathname)}`
  return (
    <Link
      href={href}
      className="mt-2 flex min-h-[44px] items-center justify-center px-4 text-[13px] font-bold text-tg-600"
    >
      불편한 점 알려 주기
    </Link>
  )
}
