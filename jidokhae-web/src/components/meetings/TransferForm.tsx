'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  meetingId: string
}

export default function TransferForm({ meetingId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (loading) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/registrations/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingId }),
      })

      const data = await res.json()

      if (data.status === 'pending_transfer') {
        router.replace(`/meetings/${meetingId}/confirm?type=pending_transfer`)
      } else if (data.status === 'waitlisted') {
        router.replace(`/meetings/${meetingId}/confirm?type=waitlisted`)
      } else if (data.status === 'already_registered') {
        setError('이미 신청한 모임입니다')
      } else {
        setError(data.message || '신청 처리에 실패했습니다')
      }
    } catch {
      setError('네트워크 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Sticky bottom button */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40"
        style={{ paddingBottom: 'calc(64px + env(safe-area-inset-bottom, 0px))' }}
      >
        <div
          className="mx-auto max-w-screen-sm px-5 py-3"
          style={{
            backgroundColor: 'var(--color-surface-50)',
            boxShadow: '0 -2px 8px rgba(45, 90, 61, 0.06)',
          }}
        >
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full rounded-[var(--radius-lg)] bg-primary-600 py-4 text-sm font-bold text-white tracking-wide transition-all hover:bg-primary-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ boxShadow: '0 4px 14px rgba(27, 67, 50, 0.25)' }}
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <svg
                  className="h-5 w-5 animate-spin text-current"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                신청 처리 중...
              </span>
            ) : (
              '신청하기'
            )}
          </button>
        </div>
      </div>

      {/* Error toast */}
      {error && (
        <div
          className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full px-5 py-2.5 text-sm font-medium text-white animate-[fadeIn_0.2s_ease-out]"
          style={{
            backgroundColor: 'var(--color-primary-800)',
            boxShadow: 'var(--shadow-elevated)',
          }}
        >
          {error}
        </div>
      )}
    </>
  )
}
