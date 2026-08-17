'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { DiscussionTopic } from '@/types/discussion'

/**
 * 발제문 관리 (전면개편 스펙 §4-1).
 * 현행 카톡 형식 그대로: 번호 · 소제목 · 인용(쪽수) · 질문.
 * 권한은 서버(API)가 검사 — 큐레이터(admin·editor·is_staff).
 */
export default function TopicsManager({
  meetingId,
  topics,
}: {
  meetingId: string
  topics: DiscussionTopic[]
}) {
  const router = useRouter()
  const [form, setForm] = useState({
    topic_no: String(topics.length + 1),
    title: '',
    quote: '',
    quote_page: '',
    question: '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function addTopic() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meeting_id: meetingId,
          topic_no: Number(form.topic_no),
          title: form.title.trim(),
          quote: form.quote.trim() || null,
          quote_page: form.quote_page.trim() || null,
          question: form.question.trim(),
        }),
      })
      const json = await res.json()
      if (json.status !== 'success') {
        setError(json.message ?? '잠시 후 다시 시도해 주세요')
        return
      }
      setForm({
        topic_no: String(Number(form.topic_no) + 1),
        title: '',
        quote: '',
        quote_page: '',
        question: '',
      })
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  async function deleteTopic(id: string) {
    if (!confirm('이 발제를 삭제할까요? 달린 답변도 함께 삭제됩니다.')) return
    await fetch('/api/admin/topics', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    router.refresh()
  }

  const inputCls =
    'w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none'

  return (
    <div>
      {/* 기존 발제 */}
      {topics.length > 0 && (
        <ul className="mb-6 space-y-3">
          {topics.map((t) => (
            <li key={t.id} className="rounded-lg border border-neutral-200 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    {t.topic_no}. {t.title}
                  </p>
                  {t.quote && (
                    <p className="mt-1 text-xs text-neutral-500">
                      “{t.quote}”{t.quote_page && ` (${t.quote_page}쪽)`}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-neutral-600">{t.question}</p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteTopic(t.id)}
                  className="flex-none text-xs font-semibold text-accent-500"
                >
                  삭제
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* 추가 폼 — 카톡 발제문 형식 그대로 */}
      <div className="space-y-2.5 rounded-lg border border-neutral-200 p-4">
        <p className="text-sm font-bold">발제 추가</p>
        <div className="flex gap-2">
          <input
            value={form.topic_no}
            onChange={(e) => setForm({ ...form, topic_no: e.target.value })}
            inputMode="numeric"
            placeholder="번호"
            className={`${inputCls} !w-16`}
          />
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="소제목 (예: 사랑과 관념)"
            className={inputCls}
          />
        </div>
        <textarea
          value={form.quote}
          onChange={(e) => setForm({ ...form, quote: e.target.value })}
          rows={2}
          placeholder="인용문 (선택)"
          className={inputCls}
        />
        <input
          value={form.quote_page}
          onChange={(e) => setForm({ ...form, quote_page: e.target.value })}
          placeholder="쪽수 (선택, 예: 289)"
          className={inputCls}
        />
        <textarea
          value={form.question}
          onChange={(e) => setForm({ ...form, question: e.target.value })}
          rows={3}
          placeholder="질문 (예: 사랑에 관해 나만의 관념이 있었나요?)"
          className={inputCls}
        />
        {error && <p className="text-xs font-semibold text-accent-500">{error}</p>}
        <button
          type="button"
          onClick={addTopic}
          disabled={busy || !form.title.trim() || !form.question.trim()}
          className="w-full rounded-lg bg-primary-600 py-2.5 text-sm font-bold text-white disabled:bg-neutral-200 disabled:text-neutral-400"
        >
          {busy ? '등록 중…' : '발제 등록 (신청자에게 알림이 가요)'}
        </button>
      </div>
    </div>
  )
}
