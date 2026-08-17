import Link from 'next/link'
import { Sec, BoxWhite, BtnSoft } from '@/components/next/TossUI'
import { formatKoreanDate, formatKoreanTime, formatFee } from '@/lib/kst'
import type { TopicWithStats } from '@/types/discussion'

/**
 * 이야기 탭 표현 (전면개편 스펙 §2 — "무슨 책, 무슨 말?").
 * 마감 후에도 축소하지 않는다 — 신청 CTA만 사라지고 스레드가 주인공 (스펙 §9).
 * 발제 0개 = "준비하고 있어요" 빈 상태 (스펙 §10 QA).
 */

export type TalkData = {
  discussion: {
    id: string
    title: string
    date: string
    time: string
    venueName: string
    fee: number
    open: boolean
    applied: boolean
    isToday: boolean
    /** "8명 중 5명이 답했어요" — 신청자 없으면 null */
    progress: { answered: number; total: number; mine: number; topicCount: number } | null
  } | null
  topics: TopicWithStats[]
  past: { id: string; title: string; monthLabel: string }[]
}

export default function TalkView({ data }: { data: TalkData }) {
  const { discussion, topics, past } = data

  return (
    <div className="pt-2">
      {discussion ? (
        <>
          {/* 책 헤더 */}
          <div className="mt-4 flex items-center gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-extrabold text-brand">
                {discussion.open ? '이달의 토론 · 신청 열림' : '이달의 토론'}
              </p>
              <h1 className="mt-0.5 truncate text-[19px] font-extrabold tracking-[-0.03em] text-tg-900">
                {discussion.title}
              </h1>
              <p className="mt-0.5 text-xs text-tg-600">
                {formatKoreanDate(discussion.date)} {formatKoreanTime(discussion.time)} ·{' '}
                {discussion.venueName}
              </p>
            </div>
          </div>

          {/* 진행 프로그레스 — 부담 노출 (2026-08-14 결정) */}
          {discussion.progress && discussion.progress.total > 0 && (
            <div className="mt-4 rounded-[15px] bg-tg-100 px-4 py-3">
              <div className="flex justify-between text-[11.5px] font-bold">
                <span className="text-brand-deep">
                  {discussion.progress.total}명 중 {discussion.progress.answered}명이 답했어요
                </span>
                <span className="font-semibold text-tg-600">
                  내 답변 {discussion.progress.mine}/{discussion.progress.topicCount}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-tg-200">
                <i
                  className="block h-full rounded-full bg-brand"
                  style={{
                    width: `${Math.round((discussion.progress.answered / discussion.progress.total) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* 신청 CTA — 열림 + 미신청일 때만. 구경로 재사용 */}
          {discussion.open && !discussion.applied && (
            <BtnSoft href={`/meetings/${discussion.id}`}>
              신청하기 · {formatFee(discussion.fee)}
            </BtnSoft>
          )}

          {/* 당일 라이브 배너 */}
          {discussion.isToday && (
            <Link
              href={`/talk/live/${discussion.id}`}
              className="mt-3 block rounded-[18px] bg-brand-bg p-4"
            >
              <p className="text-[13.5px] font-extrabold text-brand-deep">
                오늘이 모임 날이에요
              </p>
              <p className="mt-1 text-xs text-tg-700">
                모임 화면으로 열면 발제가 큰 글자로 나와요 — 종이 대신 함께 봐요
              </p>
            </Link>
          )}

          {/* 발제문 */}
          <Sec>발제문</Sec>
          {topics.length === 0 ? (
            <div className="mt-2 rounded-[18px] border border-dashed border-tg-300 p-5 text-center">
              <p className="text-sm font-bold text-tg-700">발제문을 준비하고 있어요</p>
              <p className="mt-1 text-xs text-tg-600">
                올라오면 알림으로 알려드릴게요
              </p>
            </div>
          ) : (
            <div>
              {topics.map((t) => (
                <Link
                  key={t.id}
                  href={`/talk/topics/${t.id}`}
                  className="flex min-h-[56px] items-center gap-3 border-t border-tg-100 py-3 first:border-t-0"
                >
                  <span
                    className={`flex h-7 w-7 flex-none items-center justify-center rounded-[9px] text-xs font-extrabold ${
                      t.my_answered
                        ? 'bg-brand-bg text-brand-deep'
                        : 'bg-tg-100 text-tg-700'
                    }`}
                  >
                    {t.topic_no}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-bold tracking-tight">
                      {t.title}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-tg-600">
                      {t.question}
                    </span>
                  </span>
                  <span
                    className={`flex-none text-[11.5px] font-bold ${
                      t.answer_count > 0 ? 'text-brand' : 'text-warnx'
                    }`}
                  >
                    {t.answer_count > 0 ? `답변 ${t.answer_count}` : '아직 없음'}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="mt-6 rounded-[18px] border border-dashed border-tg-300 p-6 text-center">
          <p className="text-sm font-bold text-tg-700">다음 토론모임을 준비하고 있어요</p>
          <p className="mt-1 text-xs text-tg-600">책이 정해지면 여기서 발제문을 볼 수 있어요</p>
        </div>
      )}

      {/* 지난 토론 */}
      {past.length > 0 && (
        <>
          <Sec aside={`${past.length}권`}>지난 토론</Sec>
          <div>
            {past.map((p) => (
              <BoxWhite key={p.id} className="!mt-2">
                <div className="flex items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10.5px] font-bold text-tg-500">
                      {p.monthLabel}
                    </span>
                    <span className="block truncate text-sm font-bold tracking-tight">
                      {p.title}
                    </span>
                  </span>
                </div>
              </BoxWhite>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
