'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ADMIN_MENU_GROUPS } from './adminMenu'

type Props = {
  role: 'admin' | 'editor'
  nickname: string
  onNavigate?: () => void // drawer 안에서 링크 클릭 시 닫기용
}

/**
 * 관리자 사이드바 — 데스크톱 고정 (≥lg) / 모바일 Drawer 내부.
 * active 메뉴는 usePathname() 매칭.
 *
 * - /admin 은 정확 매칭 (대시보드)
 * - /admin/meetings/new 같은 하위 경로는 /admin/meetings active
 */
export default function AdminSidebar({ role, nickname, onNavigate }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin'
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  async function handleLogout() {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/auth/login')
    } catch {
      setLoggingOut(false)
    }
  }

  const roleLabel = role === 'admin' ? '운영자' : '운영진'

  return (
    <div className="flex h-full flex-col bg-primary-900 text-surface-100">
      {/* Brand */}
      <div className="border-b border-white/8 px-5 pb-4 pt-5">
        <div
          className="text-lg font-bold tracking-tight text-surface-100"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          지독해
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
          <span>관리자</span>
          <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] tracking-wider text-surface-100">
            {roleLabel}
          </span>
        </div>
      </div>

      {/* Menu */}
      <nav aria-label="관리자 메뉴" className="flex-1 overflow-y-auto py-3">
        {ADMIN_MENU_GROUPS.map((group) => {
          // editor 권한이면 adminOnly 항목 필터
          const visibleItems = group.items.filter(
            (item) => !item.adminOnly || role === 'admin',
          )
          if (visibleItems.length === 0) return null

          return (
            <div key={group.label} className="mb-1">
              <div className="px-5 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
                {group.label}
              </div>
              <ul className="flex flex-col">
                {visibleItems.map((item) => {
                  const active = isActive(item.href)
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        aria-current={active ? 'page' : undefined}
                        className={`flex items-center gap-3 border-l-2 px-5 py-2.5 text-[13px] transition-colors ${
                          active
                            ? 'border-accent-500 bg-accent-500/12 font-semibold text-surface-100'
                            : 'border-transparent text-surface-100/70 hover:bg-white/5 hover:text-surface-100'
                        }`}
                      >
                        {item.label}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/8 px-5 py-4">
        <div className="mb-2 text-[11px] font-medium text-neutral-400">
          {nickname}
        </div>
        <div className="flex items-center justify-between">
          <Link
            href="/"
            onClick={onNavigate}
            className="text-xs font-medium text-surface-100/70 transition-colors hover:text-surface-100"
          >
            사이트로 돌아가기
          </Link>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="text-xs font-medium text-accent-300 transition-colors hover:text-accent-200 disabled:opacity-50"
          >
            {loggingOut ? '로그아웃 중...' : '로그아웃'}
          </button>
        </div>
      </div>
    </div>
  )
}
