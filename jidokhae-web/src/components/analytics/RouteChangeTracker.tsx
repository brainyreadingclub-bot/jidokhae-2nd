'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { trackEvent } from '@/lib/analytics'

const SENSITIVE_PARAMS = ['paymentKey', 'orderId', 'amount']

export default function RouteChangeTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
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
