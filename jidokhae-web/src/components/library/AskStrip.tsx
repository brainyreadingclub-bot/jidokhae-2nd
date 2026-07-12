'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import BookSearchInput from '@/components/library/BookSearchInput'
import { trackEvent } from '@/lib/analytics'

type Props = {
  meetingId: string
  /** "N월 정기모임 · 서재에 기록해두세요" 의 앞부분 라벨. 예: "7월 정기모임" */
  meetingLabel: string
}

export default function AskStrip({ meetingId, meetingLabel }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    trackEvent('ask_strip_view', { meeting_id: meetingId })
  }, [meetingId])

  async function handleDismiss() {
    setClosing(true)
    try {
      await fetch('/api/library/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss', meetingId }),
      })
      trackEvent('ask_dismissed', { meeting_id: meetingId })
      router.refresh()
    } finally {
      setClosing(false)
    }
  }

  return (
    <section className="mt-6 rounded-[var(--radius-md)] border border-primary-200 bg-primary-50 p-3">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary-200 bg-white text-primary-600">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p
            className="text-sm font-bold text-primary-700"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            무슨 책 읽으셨어요?
          </p>
          <p className="mt-0.5 text-caption text-primary-600 break-keep">
            {meetingLabel} · 서재에 기록해두세요
          </p>
        </div>
        <button
          onClick={handleDismiss}
          disabled={closing}
          aria-label="닫기"
          className="shrink-0 text-neutral-400 disabled:opacity-50"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>

      {open ? (
        <div className="mt-3">
          <BookSearchInput askMeetingId={meetingId} />
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="mt-3 w-full rounded-[var(--radius-md)] bg-primary-500 py-2 text-sm font-semibold text-white"
        >
          책 기록하기
        </button>
      )}
    </section>
  )
}
