'use client'

import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'library_intro_dismissed'
const listeners = new Set<() => void>()

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

// 클라이언트: localStorage 값. 서버/하이드레이션: 항상 숨김(깜빡임·불일치 방지)
function getSnapshot() {
  return localStorage.getItem(STORAGE_KEY) === '1'
}

function getServerSnapshot() {
  return true
}

export default function LibraryIntroStrip() {
  const dismissed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  if (dismissed) return null

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1')
    listeners.forEach((l) => l())
  }

  return (
    <div className="mt-6 flex items-start gap-2 rounded-[var(--radius-md)] bg-surface-50 border border-neutral-200 p-3">
      <p className="min-w-0 flex-1 text-caption text-neutral-600 break-keep">
        새로 생긴 <b className="text-primary-600">내 서재</b> — 모임에서 읽은 책을 담아두면 여기 쌓여요.
      </p>
      <button
        onClick={dismiss}
        aria-label="안내 닫기"
        className="shrink-0 text-neutral-400"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </button>
    </div>
  )
}
