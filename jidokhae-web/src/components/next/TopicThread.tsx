'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { trackEvent } from '@/lib/analytics'
import type { DiscussionTopic, AnswerWithMeta } from '@/types/discussion'

/**
 * 발제 스레드 (전면개편 스펙 §4-1).
 * 읽기 = 회원 전체 / 쓰기 = 신청자 (canWrite prop — 서버에서 판정).
 * 미신청자 입력창 자리에는 "신청하면 함께 이야기할 수 있어요".
 */
export default function TopicThread({
  topic,
  answers,
  canWrite,
  myUserId,
}: {
  topic: DiscussionTopic
  answers: AnswerWithMeta[]
  canWrite: boolean
  myUserId: string | null
}) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const myAnswer = myUserId ? answers.find((a) => a.user_id === myUserId) : undefined
  const others = answers.filter((a) => a.id !== myAnswer?.id)

  async function submitAnswer() {
    if (submitting || body.trim().length === 0) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${topic.id}/answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      })
      const json = await res.json()
      if (json.status !== 'success') {
        setError(json.message ?? '잠시 후 다시 시도해 주세요')
        return
      }
      trackEvent('topic_answer_submit', { topic_id: topic.id })
      setBody('')
      router.refresh()
    } catch {
      setError('잠시 후 다시 시도해 주세요')
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleReaction(answerId: string) {
    await fetch(`/api/answers/${answerId}/reactions`, { method: 'POST' })
    router.refresh()
  }

  return (
    <div className="pt-2">
      {/* 발제 인용 박스 */}
      <div className="mt-3 rounded-[16px] bg-tg-100 p-4">
        {topic.quote && (
          <>
            <p className="text-[13.5px] font-bold leading-relaxed tracking-tight text-tg-900">
              “{topic.quote}”
            </p>
            {topic.quote_page && (
              <p className="mt-1 text-[11px] text-tg-600">{topic.quote_page}쪽</p>
            )}
          </>
        )}
        <p className="mt-2.5 text-[12.5px] leading-relaxed text-tg-700">{topic.question}</p>
      </div>

      {/* 내 답변 */}
      {myAnswer && (
        <div className="mt-3 rounded-[16px] border-[1.5px] border-brand bg-white p-4">
          <p className="text-[11px] font-extrabold text-brand-deep">내가 쓴 답변</p>
          <p className="mt-1.5 whitespace-pre-wrap text-[12.5px] leading-relaxed text-tg-800">
            {myAnswer.body}
          </p>
          {(myAnswer.reaction_count > 0 || myAnswer.reply_count > 0) && (
            <p className="mt-2.5 border-t border-tg-100 pt-2 text-[11px] text-tg-600">
              {myAnswer.reaction_count > 0 && (
                <b className="font-extrabold text-brand-deep">
                  {myAnswer.reaction_count}명
                </b>
              )}
              {myAnswer.reaction_count > 0 && '이 공감'}
              {myAnswer.reaction_count > 0 && myAnswer.reply_count > 0 && ' · '}
              {myAnswer.reply_count > 0 && `답글 ${myAnswer.reply_count}개`}
            </p>
          )}
        </div>
      )}

      {/* 다른 사람 답변 */}
      {others.map((a) => (
        <div key={a.id} className="border-t border-tg-100 py-3.5 first:border-t-0">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-brand-bg text-[10px] font-extrabold text-brand-deep">
              {a.nickname.slice(0, 1)}
            </span>
            <span className="text-xs font-extrabold">{a.nickname}</span>
            {a.pinned && (
              <span className="rounded-[5px] bg-brand-bg px-1.5 py-0.5 text-[10px] font-extrabold text-brand-deep">
                모임에서 이어가요
              </span>
            )}
          </div>
          <p className="mt-1.5 whitespace-pre-wrap pl-8 text-[12.5px] leading-relaxed text-tg-800">
            {a.body}
          </p>
          <div className="mt-1.5 flex gap-3 pl-8">
            <button
              type="button"
              onClick={() => toggleReaction(a.id)}
              className={`min-h-[32px] text-[11px] font-semibold ${
                a.my_reacted ? 'text-brand-deep' : 'text-tg-500'
              }`}
            >
              ♡ {a.reaction_count > 0 ? a.reaction_count : '공감'}
            </button>
            {a.reply_count > 0 && (
              <span className="flex min-h-[32px] items-center text-[11px] text-tg-500">
                답글 {a.reply_count}
              </span>
            )}
          </div>
        </div>
      ))}

      {others.length === 0 && !myAnswer && (
        <p className="mt-4 rounded-[14px] bg-tg-50 p-4 text-center text-xs text-tg-600">
          아직 답변이 없어요 — 첫 답을 남겨보세요
        </p>
      )}

      {/* 입력 — 자격에 따라 분기 (스펙 §10 QA) */}
      {canWrite ? (
        !myAnswer && (
          <div className="mt-4 border-t border-tg-100 pt-3">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="생각을 남겨보세요"
              className="w-full rounded-[12px] bg-tg-100 p-3 text-[13px] leading-relaxed text-tg-900 placeholder:text-tg-500 focus:outline-none"
            />
            {error && <p className="mt-1 text-xs font-semibold text-warnx">{error}</p>}
            <button
              type="button"
              onClick={submitAnswer}
              disabled={submitting || body.trim().length === 0}
              className={`mt-2 flex min-h-[44px] w-full items-center justify-center rounded-[12px] text-[13px] font-bold ${
                submitting || body.trim().length === 0
                  ? 'bg-tg-100 text-tg-400'
                  : 'bg-brand text-white'
              }`}
            >
              {submitting ? '남기는 중…' : '남기기'}
            </button>
          </div>
        )
      ) : (
        <p className="mt-4 rounded-[12px] bg-tg-50 p-3.5 text-center text-xs font-semibold text-tg-600">
          신청하면 함께 이야기할 수 있어요 · 읽기는 누구나
        </p>
      )}
    </div>
  )
}
