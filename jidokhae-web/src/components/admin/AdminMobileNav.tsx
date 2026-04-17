'use client'

import { useEffect, useRef, useState } from 'react'
import AdminSidebar from './AdminSidebar'

type Props = {
  role: 'admin' | 'editor'
  nickname: string
}

/**
 * 모바일 관리자 네비게이션 (<lg).
 * - sticky 헤더 (햄버거 + 브랜드 + 역할 뱃지)
 * - 햄버거 클릭 시 왼쪽에서 슬라이드 오픈되는 Drawer (backdrop + ESC)
 * - 메뉴 링크 클릭 시 close (AdminSidebar onNavigate)
 * - 열린 상태에서 body 스크롤 lock
 */
export default function AdminMobileNav({ role, nickname }: Props) {
  const [open, setOpen] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)

  // ESC 키
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  // 열림 시 body 스크롤 lock + drawer 포커스
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    drawerRef.current?.focus()
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  const roleLabel = role === 'admin' ? '운영자' : '운영진'

  return (
    <>
      {/* Sticky header */}
      <header
        className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-surface-50 px-4 lg:hidden"
        style={{ borderColor: 'var(--color-surface-300)' }}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="관리자 메뉴 열기"
            aria-expanded={open}
            aria-controls="admin-drawer"
            className="flex h-11 w-11 items-center justify-center rounded-md text-primary-800 transition-colors hover:bg-primary-50 active:scale-[0.97]"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div className="flex items-baseline gap-2">
            <span
              className="text-[15px] font-bold tracking-tight text-primary-900"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              지독해
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-500">
              관리자
            </span>
          </div>
        </div>
        <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-600">
          {roleLabel}
        </span>
      </header>

      {/* Drawer overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 animate-[fadeIn_200ms_ease-out_both] bg-primary-900/40 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <div
        id="admin-drawer"
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="관리자 메뉴"
        tabIndex={-1}
        className={`fixed inset-y-0 left-0 z-50 w-[280px] transform transition-transform duration-250 ease-out lg:hidden ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <AdminSidebar role={role} nickname={nickname} onNavigate={() => setOpen(false)} />
      </div>
    </>
  )
}
