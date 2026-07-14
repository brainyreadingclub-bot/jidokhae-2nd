'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

type Tone = 'success' | 'neutral'

type ToastOptions = {
  message: string
  tone?: Tone
  /** 실행취소 등 액션 버튼. 누르면 토스트 닫힘 */
  action?: { label: string; onClick: () => void }
  /** 노출 시간(ms). 기본 3000, undo는 6500 권장 */
  durationMs?: number
}

type ToastState = ToastOptions & { id: number }

const ToastContext = createContext<{ show: (opts: ToastOptions) => void } | null>(null)

export function useLibraryToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useLibraryToast must be used within LibraryToastProvider')
  return ctx
}

/** Provider 밖에서도 안전하게 쓰는 변형 — 없으면 no-op. AskStrip처럼 재사용 맥락용 */
export function useLibraryToastOptional() {
  const ctx = useContext(ToastContext)
  return ctx ?? { show: () => {} }
}

export default function LibraryToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const show = useCallback(
    (opts: ToastOptions) => {
      clearTimer()
      const id = Date.now()
      setToast({ ...opts, id })
      timerRef.current = setTimeout(() => setToast(null), opts.durationMs ?? 3000)
    },
    [clearTimer],
  )

  useEffect(() => () => clearTimer(), [clearTimer])

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast && (
        <div
          className="fixed inset-x-0 z-50 flex justify-center px-4"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 76px)' }}
        >
          <div
            role="status"
            aria-live="polite"
            className="flex w-full max-w-screen-sm items-center gap-3 rounded-[var(--radius-md)] bg-neutral-800 px-4 py-3 text-sm text-white shadow-lg"
          >
            <span
              aria-hidden
              className={
                toast.tone === 'success'
                  ? 'flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary-400 text-[10px] font-bold text-white'
                  : 'h-2 w-2 shrink-0 rounded-full bg-neutral-400'
              }
            >
              {toast.tone === 'success' ? '✓' : ''}
            </span>
            <span className="min-w-0 flex-1 break-keep">{toast.message}</span>
            {toast.action && (
              <button
                onClick={() => {
                  toast.action!.onClick()
                  clearTimer()
                  setToast(null)
                }}
                className="shrink-0 font-bold text-primary-300"
              >
                {toast.action.label}
              </button>
            )}
          </div>
        </div>
      )}
    </ToastContext.Provider>
  )
}
