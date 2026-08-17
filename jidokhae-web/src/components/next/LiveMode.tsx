'use client'

import { useEffect, useState } from 'react'
import { trackEvent } from '@/lib/analytics'
import type { DiscussionTopic } from '@/types/discussion'

/**
 * 모임 자리 모드 (전면개편 스펙 §4-1).
 * 큰 글자로 발제 1개/화면, 좌우 넘김. 정적 — 실시간 동기화 아님(각자 넘김, 스펙 §10).
 */
export type LiveTopic = DiscussionTopic & {
  answers: { nickname: string; body: string; pinned: boolean }[]
}

export default function LiveMode({
  meetingTitle,
  topics,
}: {
  meetingTitle: string
  topics: LiveTopic[]
}) {
  const [idx, setIdx] = useState(0)
  const [showAnswers, setShowAnswers] = useState(false)

  useEffect(() => {
    trackEvent('meeting_mode_open')
  }, [])

  if (topics.length === 0) {
    return (
      <p className="mt-10 rounded-[14px] bg-tg-50 p-5 text-center text-sm text-tg-600">
        발제문이 아직 없어요
      </p>
    )
  }

  const t = topics[idx]

  return (
    <div className="flex min-h-[70dvh] flex-col pt-2">
      <p className="mt-2 text-xs font-bold text-tg-500">
        {meetingTitle} · 발제 {idx + 1} / {topics.length}
      </p>

      {/* 발제 본문 — 모임 자리용 큰 글자 */}
      <div className="mt-5 flex-1">
        {t.quote && (
          <>
            <p className="text-[19px] font-extrabold leading-[1.5] tracking-[-0.02em] text-tg-900">
              “{t.quote}”
            </p>
            {t.quote_page && (
              <p className="mt-2 text-[11.5px] font-semibold text-tg-400">
                {t.quote_page}쪽
              </p>
            )}
          </>
        )}
        <p className="mt-4 text-[15px] leading-[1.7] tracking-tight text-tg-700">
          {t.question}
        </p>

        {/* 미리 쓴 답변 */}
        {t.answers.length > 0 && (
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setShowAnswers((v) => !v)}
              className="flex min-h-[44px] w-full items-center justify-center rounded-[14px] bg-brand text-[13px] font-bold text-white"
            >
              미리 쓴 답변 {t.answers.length}개 {showAnswers ? '접기' : '함께 보기'}
            </button>
            {showAnswers && (
              <div className="mt-3">
                {t.answers.map((a, i) => (
                  <div key={i} className="border-t border-tg-100 py-3 first:border-t-0">
                    <p className="flex items-center gap-2 text-xs font-extrabold">
                      {a.nickname}
                      {a.pinned && (
                        <span className="rounded-[5px] bg-brand-bg px-1.5 py-0.5 text-[10px] font-extrabold text-brand-deep">
                          모임에서 이어가요
                        </span>
                      )}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-tg-800">
                      {a.body}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 넘김 바 */}
      <div className="sticky bottom-16 mt-6 flex items-center gap-3 bg-white py-2">
        <button
          type="button"
          aria-label="이전 발제"
          onClick={() => {
            setIdx((v) => Math.max(0, v - 1))
            setShowAnswers(false)
          }}
          disabled={idx === 0}
          className={`flex h-11 w-11 flex-none items-center justify-center rounded-full text-lg ${
            idx === 0 ? 'bg-tg-50 text-tg-300' : 'bg-tg-100 text-tg-700'
          }`}
        >
          ‹
        </button>
        <div className="flex flex-1 justify-center gap-1.5">
          {topics.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === idx ? 'w-4 bg-brand' : 'w-1.5 bg-tg-300'
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          aria-label="다음 발제"
          onClick={() => {
            setIdx((v) => Math.min(topics.length - 1, v + 1))
            setShowAnswers(false)
          }}
          disabled={idx === topics.length - 1}
          className={`flex h-11 w-11 flex-none items-center justify-center rounded-full text-lg ${
            idx === topics.length - 1 ? 'bg-tg-50 text-tg-300' : 'bg-tg-100 text-tg-700'
          }`}
        >
          ›
        </button>
      </div>
    </div>
  )
}
