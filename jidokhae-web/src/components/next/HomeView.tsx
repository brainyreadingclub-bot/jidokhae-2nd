import Link from 'next/link'
import TrackedLink from '@/components/analytics/TrackedLink'
import { Sec, BoxWhite, RowItem, Chevron } from '@/components/next/TossUI'
import { formatKoreanDate, formatKoreanTime } from '@/lib/kst'

/**
 * 홈 탭 표현 (전면개편 스펙 §2 — "지금 나 뭐 해야 하지?").
 * 순서: 반응 → 다음 모임(큰 숫자) → 토론 홍보 → 할 일. 목록 금지.
 * 데이터는 page가 조립 — 이 컴포넌트는 props만 (preview 검증용 분리).
 */

export type HomeData = {
  nickname: string
  /** 나를 향한 최신 미읽음 답글 — 없으면 null (빈 상태 폴백, 스펙 §10 UX) */
  reply: { actorNickname: string; preview: string; topicId: string } | null
  /** 내가 신청한(confirmed·pending_transfer) 다음 모임 */
  nextMeeting: {
    id: string
    title: string
    date: string
    time: string
    venueName: string
    daysLeft: number
    pendingTransfer: boolean
  } | null
  /** 토론 홍보 — 미신청 + 신청 열림일 때만 (마감 후엔 문구 전환) */
  promo: {
    meetingId: string
    title: string
    date: string
    time: string
    venueName: string
    open: boolean
    /** 연결된 책 표지 (2026-08-18 표지 배치 — 홈은 중형 60×90 절제) */
    thumbnail: string | null
    authors: string | null
  } | null
  /** 답 안 한 발제 (신청한 토론이 있을 때) */
  todo: { meetingId: string; unanswered: number; answeredLine: string } | null
}

export default function HomeView({ data }: { data: HomeData }) {
  const { nickname, reply, nextMeeting, promo, todo } = data

  return (
    <div className="pt-2">
      {/* 인사 — 반응이 있으면 그게 헤드라인 */}
      <h1 className="mt-3 text-[21px] font-extrabold leading-[1.3] tracking-[-0.03em] text-tg-900">
        {reply ? (
          <>
            {nickname}님,
            <br />
            <span className="text-brand">{reply.actorNickname}님이</span> 답을 남겼어요
          </>
        ) : (
          <>
            {nickname}님,
            <br />
            오늘도 읽어볼까요
          </>
        )}
      </h1>

      {/* 반응 카드 — 홈이 발제 스레드로 사람을 보내는지 측정 */}
      {reply && (
        <TrackedLink
          eventName="home_card_click"
          eventParams={{ card: 'reply' }}
          href={`/talk/topics/${reply.topicId}`}
          className="mt-4 block rounded-[18px] bg-brand-bg p-4"
        >
          <p className="text-xs font-extrabold text-brand-deep">💬 내 답변에 온 답글</p>
          <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-tg-800">
            {reply.preview}
          </p>
          <span className="mt-2.5 inline-flex min-h-[36px] items-center rounded-[10px] bg-white px-3.5 text-xs font-bold text-brand-deep shadow-sm">
            답글 보러 가기
          </span>
        </TrackedLink>
      )}

      {/* 다음 모임 — 토스식 큰 숫자 */}
      {nextMeeting && (
        <BoxWhite>
          <Link href={`/meetings/${nextMeeting.id}`} className="flex items-center gap-3.5">
            <span className="text-[31px] font-extrabold tracking-[-0.04em] text-tg-900 tabular-nums">
              {nextMeeting.daysLeft}
              <i className="not-italic text-[15px] font-bold text-tg-400">일</i>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold tracking-tight">
                {nextMeeting.title}까지
              </span>
              <span className="mt-0.5 block truncate text-xs text-tg-600">
                {formatKoreanDate(nextMeeting.date)} {formatKoreanTime(nextMeeting.time)} ·{' '}
                {nextMeeting.venueName}
                {nextMeeting.pendingTransfer && ' · 입금 확인 중'}
              </span>
            </span>
            <Chevron />
          </Link>
        </BoxWhite>
      )}

      {/* 토론 홍보 — 표지 중형(60×90), 버튼은 "발제문 먼저 읽어보기" (신청 강요 금지) */}
      {promo && (
        <BoxWhite>
          <TrackedLink
            eventName="home_card_click"
            eventParams={{ card: 'promo', open: promo.open }}
            href="/talk"
            className="flex items-center gap-3.5"
          >
            {promo.thumbnail && (
              <img
                src={promo.thumbnail}
                alt={promo.title}
                width={60}
                height={90}
                className="h-[90px] w-[60px] flex-none rounded-[5px] object-cover"
                style={{ boxShadow: '0 0 0 1px rgba(0,0,0,.06), 0 5px 12px rgba(25,31,40,.18)' }}
              />
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-[10.5px] font-extrabold text-brand">
                {promo.open ? '토론모임 · 신청 열림' : '토론모임 · 발제 이야기가 한창이에요'}
              </span>
              <span className="mt-0.5 block truncate text-[16px] font-extrabold tracking-tight">
                {promo.title}
              </span>
              <span className="mt-0.5 block truncate text-xs text-tg-600">
                {formatKoreanDate(promo.date)} {formatKoreanTime(promo.time)} · {promo.venueName}
              </span>
              <span className="mt-2 inline-flex rounded-[9px] bg-brand-bg px-3 py-1.5 text-[11px] font-bold text-brand-deep">
                발제문 먼저 읽어보기
              </span>
            </span>
          </TrackedLink>
        </BoxWhite>
      )}

      {/* 할 일 — "이번 주" 제거 (2026-08-18: 발제 마감은 주 단위가 아님) */}
      {todo && todo.unanswered > 0 && (
        <>
          <Sec>할 일</Sec>
          <RowItem
            emoji="✍️"
            tone="orange"
            title={`답하지 않은 발제 ${todo.unanswered}개`}
            sub={todo.answeredLine}
            href="/talk"
          />
        </>
      )}

      {/* 전부 비었을 때 */}
      {!reply && !nextMeeting && !promo && (!todo || todo.unanswered === 0) && (
        <div className="mt-5 rounded-[18px] border border-dashed border-tg-300 p-5 text-center">
          <p className="text-sm font-bold text-tg-700">지금은 조용해요</p>
          <p className="mt-1 text-xs text-tg-600">모임 탭에서 다음 일정을 볼 수 있어요</p>
        </div>
      )}
    </div>
  )
}
