'use client'

import { useEffect, useRef } from 'react'

type Props = {
  children: React.ReactNode
  onClose?: () => void
  /** 창 폭 — 기본은 좁은 확인 창. 목록을 담는 창(발제자 고르기)만 넓힌다 */
  widthClass?: string
}

export default function ModalOverlay({ children, onClose, widthClass = 'max-w-sm' }: Props) {
  const modalRef = useRef<HTMLDivElement>(null)
  const prevFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    prevFocusRef.current = document.activeElement as HTMLElement
    modalRef.current?.focus()

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && onClose) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      prevFocusRef.current?.focus()
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-5"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/40"
        style={{ WebkitBackdropFilter: 'blur(2px)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />
      <div
        ref={modalRef}
        tabIndex={-1}
        className={`relative w-full ${widthClass} rounded-[var(--radius-lg)] p-6 animate-[scaleIn_0.2s_ease-out] outline-none`}
        style={{
          backgroundColor: 'var(--color-surface-50)',
          boxShadow: 'var(--shadow-elevated)',
        }}
      >
        {children}
      </div>
    </div>
  )
}
