'use client'

import { useState } from 'react'

const inputClassName =
  'w-full rounded-[var(--radius-md)] px-3.5 py-3 text-sm font-medium text-primary-900 placeholder:text-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-400/40 transition-shadow'

const inputStyle = {
  backgroundColor: 'var(--color-surface-50)',
  border: '1px solid var(--color-surface-300)',
}

export default function AnnouncementForm({ memberCount }: { memberCount: number }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [href, setHref] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<number | null>(null)

  async function handleSend() {
    setError(null)
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/admin/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body, href }),
      })
      const data = await res.json()
      if (data.status !== 'success') {
        setError(data.message || '발송에 실패했습니다')
      } else {
        setSent(data.data.sent)
        setTitle('')
        setBody('')
        setHref('')
      }
    } catch {
      setError('발송에 실패했습니다')
    }
    setIsSubmitting(false)
    setConfirming(false)
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-2 block text-xs font-bold text-primary-700 tracking-tight">
          제목 (필수, 60자 이내)
        </label>
        <input
          type="text"
          value={title}
          maxLength={60}
          onChange={(e) => { setTitle(e.target.value); setSent(null) }}
          placeholder="9월 토론모임 신청이 열렸어요"
          className={inputClassName}
          style={inputStyle}
        />
      </div>
      <div>
        <label className="mb-2 block text-xs font-bold text-primary-700 tracking-tight">
          내용 (선택)
        </label>
        <input
          type="text"
          value={body}
          maxLength={120}
          onChange={(e) => setBody(e.target.value)}
          placeholder="『사랑의 생애』 — 발제문을 먼저 읽어보실 수 있어요"
          className={inputClassName}
          style={inputStyle}
        />
      </div>
      <div>
        <label className="mb-2 block text-xs font-bold text-primary-700 tracking-tight">
          이동할 화면 (선택, /로 시작하는 내부 경로)
        </label>
        <input
          type="text"
          value={href}
          onChange={(e) => setHref(e.target.value)}
          placeholder="/talk"
          className={inputClassName}
          style={inputStyle}
        />
      </div>

      {error && (
        <p className="rounded-[var(--radius-md)] bg-accent-500/10 px-4 py-3 text-sm font-medium text-accent-500">
          {error}
        </p>
      )}
      {sent !== null && (
        <p className="rounded-[var(--radius-md)] bg-primary-600/10 px-4 py-3 text-sm font-medium text-primary-700">
          회원 {sent}명의 알림함에 공지를 넣었습니다
        </p>
      )}

      {confirming ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="flex-1 rounded-[var(--radius-md)] border border-neutral-300 py-3.5 text-sm font-bold text-neutral-600"
          >
            취소
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleSend}
            className="flex-1 rounded-[var(--radius-md)] bg-primary-600 py-3.5 text-sm font-bold text-white disabled:bg-neutral-200 disabled:text-neutral-400"
          >
            {isSubmitting ? '발송 중...' : `${memberCount}명에게 보내기`}
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={!title.trim()}
          onClick={() => setConfirming(true)}
          className="w-full rounded-[var(--radius-md)] bg-primary-600 py-3.5 text-sm font-bold text-white tracking-wide transition-all hover:bg-primary-700 active:scale-[0.98] disabled:bg-neutral-200 disabled:text-neutral-400 disabled:cursor-not-allowed"
        >
          공지 보내기
        </button>
      )}

      <p className="text-xs leading-relaxed text-neutral-500">
        전 회원의 앱 알림함(🔔)에 들어갑니다. 카카오 알림톡이 아니라서 푸시는 가지 않고,
        회원이 앱을 열었을 때 조용히 보이는 채널이에요. 한 번 보내면 회수할 수 없으니
        문구를 확인하고 보내주세요.
      </p>
    </div>
  )
}
