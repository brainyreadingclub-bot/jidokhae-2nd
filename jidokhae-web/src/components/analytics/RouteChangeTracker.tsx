'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { trackEvent } from '@/lib/analytics'

// page_path는 이제 GA뿐 아니라 메타 픽셀로도 나간다(META_EVENT_MAP.page_view).
// 결제 식별자가 URL에 남아 외부로 흘러가지 않도록 여기서 끊는다.
// paymentKey·orderId는 레거시 토스, paymentId·txId는 현행 포트원 파라미터.
const SENSITIVE_PARAMS = ['paymentKey', 'orderId', 'amount', 'paymentId', 'txId']

export default function RouteChangeTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // 첫 진입 PageView는 레이아웃의 픽셀 베이스 스니펫이 이미 쐈다.
  // 여기서 또 쏘면 2중 집계 — 메타만 첫 회를 건너뛴다(GA는 그대로 쏜다).
  const isFirstRun = useRef(true)

  useEffect(() => {
    const filtered = new URLSearchParams(searchParams)
    for (const key of SENSITIVE_PARAMS) {
      filtered.delete(key)
    }
    const query = filtered.toString()
    const url = query ? `${pathname}?${query}` : pathname

    trackEvent('page_view', { page_path: url }, { skipMeta: isFirstRun.current })
    isFirstRun.current = false
  }, [pathname, searchParams])

  return null
}
