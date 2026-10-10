'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { trackEvent } from '@/lib/analytics'

const SENSITIVE_PARAMS = ['paymentKey', 'orderId', 'amount']

export default function RouteChangeTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    // 발제자 링크(/t/<토큰>) — 주소 자체가 쓰기 권한이라 분석 도구로 보내지 않는다.
    // GA4는 이벤트마다 page_location(전체 주소)을 붙이므로 가린 값으로 덮어 두고 page_view도 건너뛴다
    if (pathname.startsWith('/t/')) {
      window.gtag?.('set', {
        page_location: `${window.location.origin}/t/[token]`,
        page_path: '/t/[token]',
      })
      return
    }
    const filtered = new URLSearchParams(searchParams)
    for (const key of SENSITIVE_PARAMS) {
      filtered.delete(key)
    }
    const query = filtered.toString()
    const url = query ? `${pathname}?${query}` : pathname

    trackEvent('page_view', { page_path: url })
  }, [pathname, searchParams])

  return null
}
