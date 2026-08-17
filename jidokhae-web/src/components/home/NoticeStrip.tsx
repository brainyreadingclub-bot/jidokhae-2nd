'use client'

import { useSyncExternalStore } from 'react'

/**
 * 홈 상단 공지 스트립 (2026-08-17 시안 A).
 * site_settings.notice_text가 비어있지 않을 때만 렌더 — 운영자가 설정에서 켜고 끈다.
 * 닫기는 문구별 localStorage — 문구가 바뀌면 다시 나타난다.
 * localStorage 구독은 LibraryIntroStrip과 동일한 useSyncExternalStore 패턴.
 */

const listeners = new Set<() => void>()

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export default function NoticeStrip({ text }: { text: string }) {
  const storageKey = `notice_dismissed:${text}`
  // 서버/하이드레이션: 항상 숨김 (깜빡임·불일치 방지)
  const dismissed = useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(storageKey) === '1',
    () => true,
  )

  if (dismissed) return null

  function dismiss() {
    localStorage.setItem(storageKey, '1')
    listeners.forEach((l) => l())
  }

  return (
    <div
      className="mb-4 flex items-start gap-2.5 rounded-xl px-3.5 py-3"
      style={{ backgroundColor: 'var(--color-primary-50)' }}
    >
      <span
        className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full"
        style={{ backgroundColor: 'var(--color-primary-600)' }}
      />
      <p className="min-w-0 flex-1 text-[12.5px] font-semibold leading-relaxed text-primary-900 break-keep">
        {text}
      </p>
      <button
        type="button"
        aria-label="공지 닫기"
        className="flex h-6 w-6 flex-none items-center justify-center text-primary-400"
        onClick={dismiss}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
