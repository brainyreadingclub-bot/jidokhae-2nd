import Link from 'next/link'
import TrackedLink from '@/components/analytics/TrackedLink'
import { Sec, BoxWhite, RowItem, Chevron } from '@/components/next/TossUI'
import { formatKoreanDate, formatKoreanTime, formatFee } from '@/lib/kst'

/**
 * 홈 탭 표현 (전면개편 스펙 §2 — "지금 나 뭐 해야 하지?").
 * 순서: 반응 → 다음 모임(큰 숫자) → 가장 가까운 모임 → 토론 홍보 → 할 일. 목록 금지.
 * 데이터는 page가 조립 — 이 컴포넌트는 props만 (preview 검증용 분리).
 *
 * 2026-08-15 「홈에 목록을 두지 않는다」는 그대로 유효하다. `nearest`는 **1건**이고,
 * 그 결정문이 적어둔 홈 내용물 첫 항목(「다음 모임」)의 빈 자리를 채우는 것이다 (2026-09-19 A3).
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
  /**
   * 「가장 가까운 모임」 1건 — 신청 이력이 한 번도 없는 회원에게만 (2026-09-19 A3, ㉮안).
   * 목록이 아니다. 늘리지 말 것.
   */
  nearest: {
    id: string
    title: string
    date: string
    time: string
    venueName: string
    fee: number
  } | null
  /** 토론 홍보 — 미신청 + 신청 열림일 때만 (마감 후엔 문구 전환) */
  promo: {
    meetingId: string
    title: string
    date: string
    time: string
    venueName: string
    open: boolean
    /**
     * 신청 이력 0건 = 토론 자격 미달(정기 1회 이상, 2026-08-22)이 확실한 회원.
     * 숨기지 않고(블라인드 금지, 2026-08-14) 잠긴 이유를 라벨로 말한다.
     */
    locked: boolean
    /** 연결된 책 표지 (2026-08-18 표지 배치 — 홈은 중형 60×90 절제) */
    thumbnail: string | null
    authors: string | null
  } | null
  /** 답 안 한 발제 (신청한 토론이 있을 때) */
  todo: { meetingId: string; unanswered: number; answeredLine: string } | null
}

export default function HomeView({ data }: { data: HomeData }) {
  const { nickname, reply, nextMeeting, nearest, promo, todo } = data

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
        ) : nearest ? (
          // 오늘 처음 온 사람에게 「오늘도」는 틀린 말이다 (2026-09-19 A3 시안 06)
          <>
            {nickname}님,
            <br />
            곧 이런 모임이 있어요
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
          <Link href={`/meet/${nextMeeting.id}`} className="flex items-center gap-3.5">
            <span className="text-[31px] font-extrabold tracking-[-0.04em] text-tg-900 tabular-nums">
              {nextMeeting.daysLeft === 0 ? (
                <i className="not-italic text-[23px]">오늘</i>
              ) : (
                <>
                  {nextMeeting.daysLeft}
                  <i className="not-italic text-[15px] font-bold text-tg-400">일</i>
                </>
              )}
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

      {/*
        가장 가까운 모임 1건 — 신청 이력 0건 회원 (2026-09-19 A3 시안 06).
        「신청하기」가 아니라 「모임 자세히 보기」다 — 도착지가 상세지 결제창이 아니다.
        큰 숫자(「3일」)도 안 쓴다 — 그건 「내가 신청한 모임」의 언어라 이미 신청한 줄 안다.
      */}
      {nearest && (
        <>
          <Sec>가장 가까운 모임</Sec>
          <TrackedLink
            eventName="home_card_click"
            eventParams={{ card: 'nearest' }}
            href={`/meet/${nearest.id}`}
            className="mt-2.5 block rounded-[20px] bg-white p-4"
            style={{ boxShadow: 'var(--shadow-toss-card)' }}
          >
            <span className="block text-[10.5px] font-extrabold tracking-tight text-brand">
              {formatKoreanDate(nearest.date)} {formatKoreanTime(nearest.time)}
            </span>
            <span className="mt-[3px] block truncate text-[16px] font-extrabold tracking-[-0.03em]">
              {nearest.title}
            </span>
            <span className="mt-1 block break-keep text-xs leading-[1.5] text-tg-600">
              {nearest.venueName} · 참가비 {formatFee(nearest.fee)}
            </span>
            <span className="mt-[13px] flex h-[46px] items-center justify-center rounded-[14px] bg-brand text-sm font-extrabold tracking-tight text-white">
              모임 자세히 보기
            </span>
          </TrackedLink>
          <Link
            href="/meet"
            className="mt-3 flex h-10 items-center justify-center gap-[3px] text-[12.5px] font-bold text-tg-600"
          >
            다른 일정도 보기
            <span aria-hidden>›</span>
          </Link>
        </>
      )}

      {/* 토론 홍보 — 표지 중형(60×90), 버튼은 "발제문 먼저 읽어보기" (신청 강요 금지) */}
      {promo && (
        <>
          {/* 카드가 두 장 나란히 놓이면 이유가 필요하다. 토론은 월 1회라 「이달의」가 사실 */}
          {(nextMeeting || nearest) && <Sec>이달의 토론모임</Sec>}
          <BoxWhite>
            <TrackedLink
              eventName="home_card_click"
              eventParams={{ card: 'promo', open: promo.open, locked: promo.locked }}
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
                {/* 잠긴 것을 그린으로 칠하면 「열렸다」로 읽힌다 — 자물쇠·덮개는 얹지 않는다 */}
                <span
                  className={`block text-[10.5px] font-extrabold leading-[1.4] ${
                    promo.locked ? 'break-keep text-tg-600' : 'text-brand'
                  }`}
                >
                  {promo.locked
                    ? '정기모임에 한 번 오시면 신청할 수 있어요'
                    : promo.open
                      ? '토론모임 · 신청 열림'
                      : '토론모임 · 발제 이야기가 한창이에요'}
                </span>
                <span className="mt-0.5 block truncate text-[16px] font-extrabold tracking-tight">
                  {promo.title}
                </span>
                <span className="mt-0.5 block truncate text-xs text-tg-600">
                  {formatKoreanDate(promo.date)} {formatKoreanTime(promo.time)} · {promo.venueName}
                </span>
                {/* 자격이 없어도 읽는 것은 할 수 있다 — 현행 문구·도착지 그대로 */}
                <span className="mt-2 inline-flex rounded-[9px] bg-brand-bg px-3 py-1.5 text-[11px] font-bold text-brand-deep">
                  발제문 먼저 읽어보기
                </span>
              </span>
            </TrackedLink>
          </BoxWhite>
        </>
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

      {/*
        전부 비었을 때 — 문구는 한 글자도 안 바꿨다. 바꾼 것은 **누를 수 있게 한 것** 하나다
        (2026-09-19 A3 시안 08b). 점선 박스 + 가운데 정렬 + 링크 없음은 「고장인가?」로 읽힌다.
        「알림으로 알려드릴게요」 같은 말은 넣지 않는다 — 새 모임 알림을 보내는 코드가 없다.
      */}
      {!reply && !nextMeeting && !nearest && !promo && (!todo || todo.unanswered === 0) && (
        <Link href="/meet" className="mt-5 flex items-center gap-3 rounded-[18px] bg-tg-100 px-4 py-[18px]">
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-tg-800">지금은 조용해요</span>
            <span className="mt-[3px] block break-keep text-xs leading-[1.5] text-tg-600">
              모임 탭에서 다음 일정을 볼 수 있어요
            </span>
          </span>
          <Chevron />
        </Link>
      )}
    </div>
  )
}
