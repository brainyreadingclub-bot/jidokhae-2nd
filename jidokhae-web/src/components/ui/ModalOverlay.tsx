'use client'

import { useEffect, useRef } from 'react'

type Props = {
  children: React.ReactNode
  onClose?: () => void
}

export default function ModalOverlay({ children, onClose }: Props) {
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
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        ref={modalRef}
        tabIndex={-1}
        className="relative w-full max-w-sm rounded-[var(--radius-lg)] p-6 animate-[scaleIn_0.2s_ease-out] outline-none"
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
