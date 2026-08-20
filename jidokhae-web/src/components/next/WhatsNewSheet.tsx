'use client'

import { useSyncExternalStore } from 'react'

const SEEN_KEY = 'next_ui_whatsnew_seen_v1'

const listeners = new Set<() => void>()

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

const ITEMS = [
  {
    emoji: '🧭',
    bg: '#E7F7F0',
    title: '5개 탭으로 정리했어요',
    sub: '홈 · 모임 · 이야기 · 서재 · 나 — 흩어져 있던 것들이 제자리를 찾았어요',
  },
  {
    emoji: '💬',
    bg: '#EEF3FF',
    title: '발제문에 미리 답을 남겨요',
    sub: '토론모임 전에 이야기 탭에서 생각을 나눠보세요',
  },
  {
    emoji: '🔔',
    bg: '#FFF3EC',
    title: '알림함이 생겼어요',
    sub: '내 답변에 온 답글과 공감이 여기 모여요',
  },
]

/**
 * 새 단장 안내 바텀시트 (2026-08-17 시안 C).
 * next_ui 켠 뒤 새 홈 첫 접속에 딱 한 번 — 닫으면 다시 안 나온다 (localStorage).
 */
export default function WhatsNewSheet() {
  // 서버/하이드레이션: 항상 숨김 — 클라이언트에서 localStorage 확인 후 노출
  const seen = useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(SEEN_KEY) === '1',
    () => true,
  )

  function close() {
    localStorage.setItem(SEEN_KEY, '1')
    listeners.forEach((l) => l())
  }

  if (seen) return null

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="새로워진 지독해 안내">
      <div className="absolute inset-0 bg-[rgba(25,31,40,0.42)]" onClick={close} />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-screen-sm rounded-t-3xl bg-white px-6 pb-[max(24px,env(safe-area-inset-bottom))] pt-2.5">
        <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-tg-200" />
        <p className="text-[34px] leading-none">🌿</p>
        <h2 className="mt-2.5 text-[21px] font-extrabold leading-[1.32] tracking-[-0.03em] text-tg-900">
          지독해가 <span className="text-brand">새로워졌어요</span>
        </h2>
        <ul className="mt-4">
          {ITEMS.map((it) => (
            <li key={it.title} className="flex items-start gap-3 py-2.5">
              <span
                className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-xl text-[17px]"
                style={{ backgroundColor: it.bg }}
              >
                {it.emoji}
              </span>
              <span className="min-w-0">
                <b className="block text-[14.5px] font-extrabold tracking-[-0.02em] text-tg-900">
                  {it.title}
                </b>
                <span className="mt-0.5 block text-xs leading-normal text-tg-600">{it.sub}</span>
              </span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={close}
          className="mt-4 block w-full rounded-2xl bg-brand py-4 text-center text-[15px] font-extrabold text-white"
        >
          둘러보기
        </button>
        <button
          type="button"
          onClick={close}
          className="mx-auto mt-3 block text-xs font-semibold text-tg-500"
        >
          나중에 볼게요
        </button>
      </div>
    </div>
  )
}
