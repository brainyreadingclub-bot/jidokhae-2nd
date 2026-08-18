import Link from 'next/link'
import { Sec, BtnSoft } from '@/components/next/TossUI'
import { formatKoreanDate, formatKoreanTime, formatFee } from '@/lib/kst'
import type { TopicWithStats } from '@/types/discussion'

/**
 * 이야기 탭 표현 (전면개편 스펙 §2 — "무슨 책, 무슨 말?").
 * 마감 후에도 축소하지 않는다 — 신청 CTA만 사라지고 스레드가 주인공 (스펙 §9).
 * 발제 0개 = "준비하고 있어요" 빈 상태 (스펙 §10 QA).
 * 책 표지는 여기가 주 무대 — 포스터형 헤더 132×198 (2026-08-18 확정).
 * 지난 토론 = 모임의 공동 기록("함께 읽은 N권") — 순번·참여·발제 흔적.
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
    /** 연결된 책 (없으면 제목 텍스트 폴백) */
    thumbnail: string | null
    authors: string | null
    /** "8명 중 5명이 답했어요" — 신청자 없으면 null */
    progress: { answered: number; total: number; mine: number; topicCount: number } | null
  } | null
  topics: TopicWithStats[]
  past: {
    id: string
    title: string
    monthLabel: string
    thumbnail: string | null
    /** 전체 토론 히스토리에서 몇 번째 책인지 (1부터) */
    ordinal: number
    participantCount: number
    topicCount: number
    answerCount: number
  }[]
}

/** 1~20은 한글 서수("아홉 번째"), 그 이상은 "N번째" */
const KOREAN_ORDINALS = [
  '첫', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉', '열',
  '열한', '열두', '열세', '열네', '열다섯', '열여섯', '열일곱', '열여덟', '열아홉', '스무',
] as const

export function ordinalLabel(n: number): string {
  return n >= 1 && n <= KOREAN_ORDINALS.length ? `${KOREAN_ORDINALS[n - 1]} 번째` : `${n}번째`
}

/** 수량 관형사 ("아홉 권") — 서수와 달리 1은 "한" */
const KOREAN_COUNTS = [
  '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉', '열',
  '열한', '열두', '열세', '열네', '열다섯', '열여섯', '열일곱', '열여덟', '열아홉', '스무',
] as const

function countLabel(n: number): string {
  return n >= 1 && n <= KOREAN_COUNTS.length ? KOREAN_COUNTS[n - 1] : String(n)
}

export default function TalkView({ data }: { data: TalkData }) {
  const { discussion, topics, past } = data

  return (
    <div className="pt-2">
      {discussion ? (
        <>
          {/* 책 헤더 — 포스터형 (토론모임의 집 = 표지의 주 무대) */}
          <div
            className="-mx-5 mt-2 px-5 pb-1 pt-4 text-center"
            style={{ background: 'linear-gradient(var(--color-brand-bg, #E8F7F1), transparent 88%)' }}
          >
            <p className="text-[11px] font-extrabold text-brand">
              {discussion.open ? '이달의 토론 · 신청 열림' : '이달의 토론'}
            </p>
            {discussion.thumbnail && (
              <img
                src={discussion.thumbnail}
                alt={discussion.title}
                width={132}
                height={198}
                className="mx-auto mt-4 h-[198px] w-[132px] rounded-[6px] object-cover"
                style={{ boxShadow: '0 0 0 1px rgba(0,0,0,.06), 0 10px 24px rgba(25,31,40,.22)' }}
              />
            )}
            <h1 className="mt-4 text-[22px] font-extrabold tracking-[-0.03em] text-tg-900">
              {discussion.title}
            </h1>
            {discussion.authors && (
              <p className="mt-0.5 text-xs text-tg-600">{discussion.authors}</p>
            )}
            <p className="mt-1.5 text-xs text-tg-600">
              {formatKoreanDate(discussion.date)} {formatKoreanTime(discussion.time)} ·{' '}
              {discussion.venueName}
            </p>
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

      {/* 지난 토론 — 모임의 공동 기록 ("우리가 함께 읽은 책들") */}
      {past.length > 0 && (
        <>
          <div className="mt-7">
            <p className="text-[10.5px] font-extrabold tracking-[.08em] text-tg-500">
              지독해의 책장
            </p>
            <p className="mt-0.5 text-[17px] font-extrabold tracking-[-0.02em] text-tg-900">
              함께 읽은 {countLabel(Math.max(...past.map((p) => p.ordinal)))} 권의 책
            </p>
          </div>
          <div className="-mx-5 mt-3 flex gap-4 overflow-x-auto px-5 pb-2">
            {past.map((p) => (
              <div key={p.id} className="w-[96px] flex-none">
                <p className="text-[9.5px] font-extrabold tracking-[.05em] text-brand">
                  {ordinalLabel(p.ordinal)}
                </p>
                {p.thumbnail ? (
                  <img
                    src={p.thumbnail}
                    alt={p.title}
                    width={96}
                    height={144}
                    className="mt-1.5 h-[144px] w-[96px] rounded-[6px] object-cover"
                    style={{ boxShadow: '0 0 0 1px rgba(0,0,0,.06), 0 5px 14px rgba(25,31,40,.16)' }}
                  />
                ) : (
                  <div className="mt-1.5 flex h-[144px] w-[96px] items-center justify-center rounded-[6px] bg-tg-100 p-2 text-center text-[11px] font-bold text-tg-600">
                    {p.title}
                  </div>
                )}
                <p className="mt-1.5 truncate text-xs font-extrabold tracking-tight">{p.title}</p>
                <p className="mt-0.5 text-[10px] font-semibold text-tg-500">
                  {p.monthLabel}
                  {p.participantCount > 0 && ` · ${p.participantCount}명이 함께`}
                </p>
                {p.topicCount > 0 && (
                  <span className="mt-1.5 inline-block rounded-full bg-tg-100 px-2 py-0.5 text-[9.5px] font-bold text-tg-600">
                    발제 {p.topicCount} · 답변 {p.answerCount}
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
