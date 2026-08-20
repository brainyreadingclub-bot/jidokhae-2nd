'use client'

import { useEffect } from 'react'

/**
 * 스트리밍 페이지의 앵커 보정 (2026-08-20).
 * /my의 섹션들은 Suspense로 늦게 도착해서, 브라우저 기본 앵커 스크롤이
 * 목적지를 찾지 못하고 포기한다 (#library 등). 요소가 나타날 때까지
 * 짧게 기다렸다가 스크롤한다. 해시가 없으면 아무것도 하지 않는다.
 */
export default function HashScroller() {
  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (!hash) return

    let cancelled = false
    const started = Date.now()

    function tryScroll() {
      if (cancelled) return
      const el = document.getElementById(hash)
      if (el) {
        el.scrollIntoView({ block: 'start' })
        return
      }
      // 스트리밍 완료를 최대 5초까지 기다린다 (조건부 섹션이라 영영 안 올 수도 있음)
      if (Date.now() - started < 5000) setTimeout(tryScroll, 150)
    }

    tryScroll()
    return () => {
      cancelled = true
    }
  }, [])

  return null
}
