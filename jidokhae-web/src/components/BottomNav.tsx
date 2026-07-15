'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  {
    label: '모임 일정',
    href: '/',
    icon: CalendarIcon,
  },
  {
    label: '마이페이지',
    href: '/my',
    icon: UserIcon,
  },
] as const

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-neutral-100"
      style={{ boxShadow: 'var(--shadow-tab)' }}
    >
      <div className="mx-auto flex h-16 max-w-screen-sm items-center justify-around px-4">
        {tabs.map((tab) => {
          const isActive = tab.href === '/'
            ? pathname === '/'
            : pathname.startsWith(tab.href)

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative flex flex-1 flex-col items-center justify-center gap-1.5 min-h-[48px] py-2 transition-colors duration-150 ${
                isActive
                  ? 'text-primary-600'
                  : 'text-neutral-400 hover:text-primary-500'
              }`}
            >
              {isActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary-600" />
              )}
              <tab.icon active={isActive} />
              <span className={`text-[11px] tracking-tight ${isActive ? 'font-bold' : 'font-medium'}`}>
                {tab.label}
              </span>
            </Link>
          )
        })}
      </div>
      {/* iOS safe area */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  )
}

function CalendarIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.2 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

function UserIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.2 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}
