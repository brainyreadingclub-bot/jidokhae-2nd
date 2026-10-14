'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import BookSearchInput from '@/components/library/BookSearchInput'
import { trackEvent } from '@/lib/analytics'

type Props = {
  meetingId: string
  /** "N월 정기모임 · 서재에 기록해두세요" 의 앞부분 라벨. 예: "7월 정기모임" */
  meetingLabel: string
  /** 노출 경로 계측용. 마이페이지='my', 모임 상세='meeting_detail' */
  entryPoint?: 'my' | 'meeting_detail'
}

export default function AskStrip({ meetingId, meetingLabel, entryPoint = 'my' }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  // 닫기는 누르는 순간 띠를 숨긴다. 서버 기록이 실패하면 다시 보이고 알린다
  const [hidden, setHidden] = useState(false)
  const [dismissError, setDismissError] = useState(false)

  useEffect(() => {
    trackEvent('ask_strip_view', { meeting_id: meetingId, entry_point: entryPoint })
    // 서버 노출 기록(최초 1회). 응답률 분석용 — 실패해도 화면 영향 없음.
    fetch('/api/library/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'view', meetingId }),
    }).catch(() => {})
  }, [meetingId, entryPoint])

  async function handleDismiss() {
    if (hidden) return
    setHidden(true)
    setDismissError(false)
    try {
      const res = await fetch('/api/library/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss', meetingId }),
      })
      if (!res.ok) throw new Error('dismiss failed')
      trackEvent('ask_dismissed', { meeting_id: meetingId, entry_point: entryPoint })
      // 화면은 이미 바뀌었다 — 뒤에서 새로 받아 서버 상태와 맞춘다
      router.refresh()
    } catch {
      setHidden(false)
      setDismissError(true)
    }
  }

  if (hidden) return null

  return (
    <section
      className={`mt-6 rounded-[var(--radius-md)] border border-primary-200 bg-primary-50 p-3${
        entryPoint === 'meeting_detail' ? ' mb-8' : ''
      }`}
    >
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
            {entryPoint === 'meeting_detail' ? '이번 모임, 무슨 책 읽으셨어요?' : '무슨 책 읽으셨어요?'}
          </p>
          <p className="mt-0.5 text-caption text-primary-600 break-keep">
            {meetingLabel} · 서재에 담아두세요
          </p>
        </div>
        <button
          onClick={handleDismiss}
          aria-label="닫기"
          className="shrink-0 text-neutral-400"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>

      {dismissError && (
        <p role="alert" className="mt-2 text-caption font-semibold text-accent-600">
          닫지 못했어요. 잠시 후 다시 눌러 주세요
        </p>
      )}

      {open ? (
        <div className="mt-3">
          <BookSearchInput askMeetingId={meetingId} />
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="mt-3 w-full rounded-[var(--radius-md)] bg-primary-500 py-2 text-sm font-semibold text-white"
        >
          책 담기
        </button>
      )}
    </section>
  )
}
