'use client'

import { useEffect, useRef, useState } from 'react'
import { trackEvent } from '@/lib/analytics'
import {
  FEEDBACK_BODY_MAX,
  FEEDBACK_CATEGORIES,
  FEEDBACK_CATEGORY_LABELS,
  type FeedbackCategory,
  type FeedbackSource,
} from '@/lib/member-feedback'
import { BtnPrimary, BtnSoft } from '@/components/next/TossUI'

/**
 * 「불편한 점 알려 주기」 입력 (보관함 I-001).
 * 분류 하나 + 자유 글 500자. 어느 화면에서 왔는지는 서버로 같이 보낸다(경로만).
 * GA: 화면이 열리면 `feedback_open`, 보내기 성공 `feedback_submit` — 글 내용은 보내지 않는다
 */
export default function FeedbackForm({
  source,
  pagePath,
  backHref,
}: {
  source: FeedbackSource
  pagePath: string | null
  backHref: string
}) {
  const [category, setCategory] = useState<FeedbackCategory | null>(source === 'error' ? 'screen' : null)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const opened = useRef(false)

  useEffect(() => {
    if (opened.current) return
    opened.current = true
    trackEvent('feedback_open', { source })
  }, [source])

  const canSend = category !== null && body.trim().length > 0 && !sending

  async function send() {
    if (!canSend || !category) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, body, source, pagePath }),
      })
      const json = (await res.json().catch(() => null)) as { status?: string; message?: string } | null
      if (res.ok && json?.status === 'success') {
        trackEvent('feedback_submit', { source, category })
        setDone(true)
        return
      }
      setError(json?.message ?? '보내지 못했어요. 잠깐 뒤에 다시 시도해 주세요')
    } catch {
      setError('보내지 못했어요. 잠깐 뒤에 다시 시도해 주세요')
    } finally {
      setSending(false)
    }
  }

  if (done) {
    return (
      <div className="mt-10 flex flex-col items-center text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-bg text-[22px] font-bold text-brand-deep" aria-hidden>
          ✓
        </span>
        <h2 className="mt-4 text-[17px] font-extrabold tracking-tight text-tg-900">잘 받았어요</h2>
        <p className="mt-1.5 break-keep text-[13px] text-tg-600">알려 주셔서 고마워요. 운영진이 읽어요</p>
        <div className="mt-5 w-full">
          <BtnSoft href={backHref}>돌아가기</BtnSoft>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-2">
      <p className="break-keep text-[13px] leading-relaxed text-tg-700">
        쓰다가 막힌 곳, 바라는 점 무엇이든 좋아요. 운영진이 읽어요.
      </p>

      <fieldset className="mt-5">
        <legend className="text-[13px] font-bold text-tg-900">어떤 일인가요?</legend>
        <div role="radiogroup" aria-label="어떤 일인가요?" className="mt-2 flex flex-wrap gap-2">
          {FEEDBACK_CATEGORIES.map((c) => {
            const on = category === c
            return (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setCategory(c)}
                className={`min-h-[40px] rounded-full px-3.5 text-[13px] font-bold tracking-tight ${
                  on ? 'bg-brand text-white' : 'bg-tg-100 text-tg-700'
                }`}
              >
                {FEEDBACK_CATEGORY_LABELS[c]}
              </button>
            )
          })}
        </div>
      </fieldset>

      <label htmlFor="feedback-body" className="mt-5 block text-[13px] font-bold text-tg-900">
        자세히 알려 주세요
      </label>
      <textarea
        id="feedback-body"
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, FEEDBACK_BODY_MAX))}
        maxLength={FEEDBACK_BODY_MAX}
        rows={6}
        placeholder="언제, 어느 화면에서, 무엇이 불편했는지"
        className="mt-2 w-full rounded-[12px] bg-tg-100 p-3 text-[14px] leading-relaxed text-tg-900 placeholder:text-tg-500 focus:outline-none"
      />
      <div className="mt-1 flex items-start justify-between gap-3 text-[11px] text-tg-600">
        <span className="break-keep">이름·연락처 같은 개인정보는 적지 말아 주세요</span>
        <span className="flex-none tabular-nums">
          {body.length}/{FEEDBACK_BODY_MAX}
        </span>
      </div>
      {source === 'error' && pagePath && (
        <p className="mt-1 text-[11px] text-tg-600">문제가 난 화면 주소가 함께 전해져요</p>
      )}

      {error && <p className="mt-3 text-xs font-semibold text-warnx">{error}</p>}
      <BtnPrimary onClick={send} disabled={!canSend}>
        {sending ? '보내는 중…' : '보내기'}
      </BtnPrimary>
    </div>
  )
}
