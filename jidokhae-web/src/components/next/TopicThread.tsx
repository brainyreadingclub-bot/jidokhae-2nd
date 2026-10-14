'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { trackEvent } from '@/lib/analytics'
import type { DiscussionTopic, AnswerWithMeta } from '@/types/discussion'
import type { TopicApplyCta } from '@/lib/answer-access-rules'

/**
 * 발제 스레드 (전면개편 스펙 §4-1).
 * 읽기 = 그 모임 신청자 + 운영진 / 쓰기 = 신청자 (둘 다 서버에서 판정, 2026-10-13).
 * 읽기 자격이 없으면 서버가 남의 답변을 아예 안 내려보낸다 — 여기서는 답변 수만 보여준다.
 * 미신청자 입력창 자리에는 안내 + 모임 상세로 가는 신청 버튼(결제로 바로 보내지 않는다).
 */
export default function TopicThread({
  topic,
  answers,
  answerCount,
  canRead,
  canWrite,
  applyCta,
  myUserId,
}: {
  topic: DiscussionTopic
  answers: AnswerWithMeta[]
  /** 전체 답변 수 — 읽기 자격이 없어도 수는 보인다 */
  answerCount: number
  canRead: boolean
  canWrite: boolean
  applyCta: TopicApplyCta
  myUserId: string | null
}) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 누르는 순간 보여 줄 내 답변 — 서버 목록에 내 답변이 들어오면 그쪽이 우선한다
  const [pendingMine, setPendingMine] = useState<{ id: string; body: string } | null>(null)
  // 공감: 누르는 순간 바꿔 둔 값(답변 id → 상태). 서버 목록이 새로 오면 비운다
  const [reactions, setReactions] = useState<Record<string, { reacted: boolean; count: number }>>({})
  const [reactingIds, setReactingIds] = useState<Set<string>>(new Set())
  const [reactionError, setReactionError] = useState<string | null>(null)
  const [prevAnswers, setPrevAnswers] = useState(answers)
  if (answers !== prevAnswers) {
    setPrevAnswers(answers)
    setReactions({})
  }

  const serverMine = myUserId ? answers.find((a) => a.user_id === myUserId) : undefined
  const myAnswer: Pick<AnswerWithMeta, 'id' | 'body' | 'reaction_count' | 'reply_count'> | undefined =
    serverMine ??
    (pendingMine !== null
      ? { id: pendingMine.id, body: pendingMine.body, reaction_count: 0, reply_count: 0 }
      : undefined)
  const others = answers.filter((a) => a.id !== serverMine?.id)

  async function submitAnswer() {
    const text = body.trim()
    if (submitting || text.length === 0) return
    // 누르는 순간 내 답변 카드를 먼저 그린다. 실패하면 거두고 쓴 글을 입력칸에 돌려놓는다
    setSubmitting(true)
    setError(null)
    setPendingMine({ id: 'pending', body: text })
    setBody('')
    const rollback = (message: string) => {
      setPendingMine(null)
      setBody(text)
      setError(message)
    }
    try {
      const res = await fetch(`/api/topics/${topic.id}/answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text }),
      })
      const json = await res.json()
      if (json.status !== 'success') {
        rollback(json.message ?? '저장하지 못했어요. 잠시 후 다시 시도해 주세요')
        return
      }
      setPendingMine({ id: String(json.data?.id ?? 'saved'), body: text })
      if (!json.data?.duplicate) trackEvent('topic_answer_submit', { topic_id: topic.id })
      // 화면은 이미 바뀌었다 — 다른 화면(이야기 탭 진행률 등)이 맞도록 뒤에서 새로 받는다
      router.refresh()
    } catch {
      rollback('저장하지 못했어요. 잠시 후 다시 시도해 주세요')
    } finally {
      setSubmitting(false)
    }
  }

  function reactionOf(a: AnswerWithMeta) {
    return reactions[a.id] ?? { reacted: a.my_reacted, count: a.reaction_count }
  }

  async function toggleReaction(a: AnswerWithMeta) {
    // 응답이 오기 전 같은 답변을 또 누르면 서버에서 순서가 꼬인다 — 그 답변만 잠깐 막는다
    if (reactingIds.has(a.id)) return
    const before = reactionOf(a)
    const after = {
      reacted: !before.reacted,
      count: Math.max(0, before.count + (before.reacted ? -1 : 1)),
    }
    setReactions((r) => ({ ...r, [a.id]: after }))
    setReactingIds((s) => new Set(s).add(a.id))
    setReactionError(null)
    const done = () =>
      setReactingIds((s) => {
        const next = new Set(s)
        next.delete(a.id)
        return next
      })
    try {
      const res = await fetch(`/api/answers/${a.id}/reactions`, { method: 'POST' })
      const json = await res.json()
      if (json.status !== 'success') throw new Error()
      // 서버가 정한 상태가 다르면(다른 창에서 이미 눌렀던 경우) 서버를 따른다
      const reacted = Boolean(json.data?.reacted)
      if (reacted !== after.reacted) {
        setReactions((r) => ({
          ...r,
          [a.id]: { reacted, count: Math.max(0, before.count + (reacted ? 1 : 0) - (before.reacted ? 1 : 0)) },
        }))
      }
    } catch {
      setReactions((r) => ({ ...r, [a.id]: before }))
      setReactionError('공감을 반영하지 못했어요. 잠시 후 다시 눌러 주세요')
    } finally {
      done()
    }
  }

  return (
    <div className="pt-2">
      {/* 발제 인용 박스 */}
      <div className="mt-3 rounded-[16px] bg-tg-100 p-4">
        {topic.quote && (
          <>
            <p className="whitespace-pre-line break-words text-[13.5px] font-bold leading-relaxed tracking-tight text-tg-900">
              “{topic.quote}”
            </p>
            {topic.quote_page && (
              <p className="mt-1 text-[11px] text-tg-600">{topic.quote_page}쪽</p>
            )}
          </>
        )}
        <p className="mt-2.5 whitespace-pre-line break-words text-[12.5px] leading-relaxed text-tg-700">{topic.question}</p>
      </div>

      {/* 내 답변 */}
      {myAnswer && (
        <div className="mt-3 rounded-[16px] border-[1.5px] border-brand bg-white p-4">
          <p className="text-[11px] font-extrabold text-brand-deep">
            내가 쓴 답변
            {myAnswer.id === 'pending' && (
              <span className="ml-1.5 font-semibold text-tg-500">저장하는 중…</span>
            )}
          </p>
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
      {reactionError && (
        <p role="alert" className="mt-3 text-xs font-semibold text-warnx">
          {reactionError}
        </p>
      )}
      {others.map((a) => {
        const r = reactionOf(a)
        return (
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
              onClick={() => toggleReaction(a)}
              aria-pressed={r.reacted}
              className={`min-h-[32px] text-[11px] font-semibold ${
                r.reacted ? 'text-brand-deep' : 'text-tg-600'
              }`}
            >
              ♡ {r.count > 0 ? r.count : '공감'}
            </button>
            {a.reply_count > 0 && (
              <span className="flex min-h-[32px] items-center text-[11px] text-tg-600">
                답글 {a.reply_count}
              </span>
            )}
          </div>
        </div>
        )
      })}

      {/* 읽기 자격 없음 — 답변 수만 */}
      {!canRead && (
        <p className="mt-4 text-xs font-semibold text-tg-600">답변 {answerCount}개</p>
      )}

      {canRead && others.length === 0 && !myAnswer && (
        <p className="mt-4 rounded-[14px] bg-tg-50 p-4 text-center text-xs text-tg-600">
          아직 답변이 없어요 — 첫 답을 남겨보세요
        </p>
      )}

      {/* 입력 — 자격에 따라 분기 (스펙 §10 QA) */}
      {canWrite ? (
        !myAnswer && (
          <div className="mt-4 border-t border-tg-100 pt-3">
            {/* 실제 읽기 범위와 같아야 한다 — answer-access-rules.ts canReadAnswers */}
            <p className="mb-2 text-[11px] text-tg-600">이 모임 신청자와 운영진만 읽어요</p>
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
      ) : canRead ? null : (
        // 운영진(읽기만 가능)에게는 이 칸이 필요 없다 — 신청 안 한 회원에게만
        <div className="mt-4 rounded-[12px] bg-tg-50 p-3.5 text-center">
          <p className="break-keep text-xs font-semibold leading-relaxed text-tg-700">
            신청하면 다른 분들의 답변을 읽고 함께 이야기할 수 있어요
          </p>
          {applyCta === 'apply' ? (
            <Link
              href={`/meet/${topic.meeting_id}?from=topic`}
              onClick={() => trackEvent('topic_apply_click', { topic_id: topic.id })}
              className="mt-2.5 flex min-h-[44px] items-center justify-center rounded-[12px] bg-brand text-[13px] font-bold text-white"
            >
              모임 보고 신청하기
            </Link>
          ) : (
            <p className="mt-2.5 flex min-h-[40px] items-center justify-center rounded-[12px] bg-tg-100 text-xs font-bold text-tg-600">
              {applyCta === 'full'
                ? '정원이 다 찼어요'
                : applyCta === 'waitlisted'
                  ? '대기 중이에요 — 자리가 나면 함께 읽을 수 있어요'
                  : '신청이 마감됐어요'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
