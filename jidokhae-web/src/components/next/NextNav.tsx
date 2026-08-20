'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * next_ui 5탭 하단 내비 (전면개편 스펙 §2).
 * 토스 스킨: 활성 tg-900 / 비활성 tg-400, 테두리 대신 tg-100 헤어라인.
 */
const tabs = [
  { label: '홈', href: '/home', icon: HomeIcon },
  { label: '모임', href: '/meet', icon: CalendarIcon },
  { label: '이야기', href: '/talk', icon: TalkIcon },
  { label: '서재', href: '/shelf', icon: ShelfIcon },
  { label: '나', href: '/me', icon: UserIcon },
] as const

export default function NextNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-tg-100 bg-white">
      <div className="mx-auto flex h-14 max-w-screen-sm items-center justify-around px-2">
        {tabs.map((tab) => {
          // 정확 일치 또는 하위 경로만 — 단순 startsWith는 /meet가 /me에 걸린다
          const isActive =
            pathname === tab.href || pathname.startsWith(tab.href + '/')
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex min-h-[48px] flex-1 flex-col items-center justify-center gap-0.5 py-1.5 transition-colors duration-150 ${
                isActive ? 'text-tg-900' : 'text-tg-400'
              }`}
            >
              <tab.icon active={isActive} />
              <span className={`text-[10px] tracking-tight ${isActive ? 'font-bold' : 'font-semibold'}`}>
                {tab.label}
              </span>
            </Link>
          )
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  )
}

type IconProps = { active: boolean }
const sw = (active: boolean) => (active ? 2.2 : 1.8)

function HomeIcon({ active }: IconProps) {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw(active)} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.8V20h13V9.8" />
    </svg>
  )
}

function CalendarIcon({ active }: IconProps) {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw(active)} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  )
}

function TalkIcon({ active }: IconProps) {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw(active)} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a8 8 0 0 1-8 8H4l2.2-2.6A8 8 0 1 1 21 12z" />
    </svg>
  )
}

function ShelfIcon({ active }: IconProps) {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw(active)} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h6v16H4zM10 4h5v16h-5z" />
      <path d="M15.5 5.6l3.6-.9 2.4 14.6-3.6.9z" />
    </svg>
  )
}

function UserIcon({ active }: IconProps) {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw(active)} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20c1.4-3.6 4.2-5.4 7.5-5.4s6.1 1.8 7.5 5.4" />
    </svg>
  )
}
