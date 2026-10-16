import TrackedLink from '@/components/analytics/TrackedLink'
import { Sec } from '@/components/next/TossUI'
import { formatKoreanTime } from '@/lib/kst'
import { FROM_HOME_UPCOMING, FROM_HOME_UPCOMING_MORE, type UpcomingAction } from '@/lib/home-upcoming'

/**
 * 홈 「다가오는 정기모임」 — 최대 3건 (2026-10-13 시안).
 * 데이터는 page가 고른다: regular · active · 오늘 이후 · 내가 신청한 것(취소 제외) 빼고 · 날짜순 3건.
 * 0건이면 page가 빈 배열을 넘기고 이 칸은 통째로 안 그린다.
 *
 * 남은 자리는 3자리 이하일 때만 말한다 — 넉넉할 때 숫자를 보이면 「아무도 안 오나」로 읽힌다.
 * 마감된 모임도 보여 준다 (2026-10-15 — 2차 수정의 「마감 제외」를 되돌림).
 * 카드 전체가 모임 상세로 가는 링크다. 오른쪽 표시(신청하기·대기 신청하기·마감)는 그 안의 표시라
 * 카드·버튼 클릭은 같은 클릭이다. 표시는 모임 상세 버튼과 같은 판정·같은 문구·같은 색 계열
 * 클릭 기록: 링크의 `from`(+카드는 `pos`)을 받은 쪽 페이지가 after()로 기록표(app_events)에 남긴다 —
 *   카드 = home_upcoming.meeting_click(/meet/[id]), 「다른 일정도 보기」 = home_upcoming.more_click(/meet).
 *   lib/home-upcoming.ts · lib/app-events.ts 참조
 */

export type UpcomingRegular = {
  id: string
  date: string
  time: string
  region: string
  venueName: string
  /** 남은 자리 — `getSeatStatus`가 「n자리 남았어요」일 때만 수, 그 밖(넉넉함·가림·마감)은 null */
  seatsLeft: number | null
  /** 모임 상세 버튼과 같은 판정 (`toUpcomingAction(getButtonState(...))`) */
  action: UpcomingAction
}

/** 상세 버튼(toss 스킨)과 같은 문구·색 계열 — 주 버튼 그린 / 대기 주황 / 마감 회색 */
const ACTION_VIEW: Record<UpcomingAction, { label: string; className: string }> = {
  register: { label: '신청하기', className: 'bg-brand-bg text-brand-deep' },
  join_waitlist: { label: '대기 신청하기', className: 'bg-warnx-bg text-warnx' },
  full: { label: '마감', className: 'bg-tg-100 text-tg-500' },
}

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'] as const

function dayParts(date: string) {
  const d = new Date(`${date}T12:00:00+09:00`)
  const [, month, day] = date.split('-').map(Number)
  return { month, day, weekday: WEEKDAY[d.getUTCDay()] }
}

export default function UpcomingRegulars({ items }: { items: UpcomingRegular[] }) {
  if (items.length === 0) return null

  return (
    <>
      <Sec>다가오는 정기모임</Sec>
      <div
        className="mt-2.5 rounded-[20px] bg-white px-4 py-1"
        style={{ boxShadow: 'var(--shadow-toss-card)' }}
      >
        {items.map((m, i) => {
          const { month, day, weekday } = dayParts(m.date)
          const action = ACTION_VIEW[m.action]
          return (
            <TrackedLink
              key={m.id}
              eventName="home_card_click"
              eventParams={{ card: 'upcoming', position: i + 1 }}
              href={`/meet/${m.id}?from=${FROM_HOME_UPCOMING}&pos=${i + 1}`}
              className="flex min-h-[68px] items-center gap-3 border-t border-tg-100 py-3 first:border-t-0"
            >
              <span className="w-11 flex-none text-center">
                <span className="block text-[10px] font-semibold text-tg-600">{month}월</span>
                <span className="block text-[19px] font-extrabold leading-tight tracking-tight tabular-nums">
                  {day}
                </span>
                <span className="block text-[10px] font-semibold text-tg-600">{weekday}</span>
              </span>
              <span className="min-w-0 flex-1">
                {/* 지역을 장소보다 한 단계 진하게 — 어디서 하는지가 먼저 읽히게 */}
                <span className="block truncate text-sm tracking-tight">
                  <b className="font-extrabold text-tg-900">{m.region}</b>
                  <span className="font-semibold text-tg-700"> · {m.venueName}</span>
                </span>
                <span className="mt-0.5 block truncate text-xs text-tg-600">
                  {formatKoreanTime(m.time)}
                  {/* 자리 상태 공통 규칙(seat-status.ts) — 빨강·주황 없이 진한 회색 굵게 (문구표준 §2) */}
                  {m.seatsLeft !== null && m.seatsLeft > 0 && (
                    <b className="font-bold text-tg-800"> · {m.seatsLeft}자리 남았어요</b>
                  )}
                </span>
              </span>
              <span className={`flex h-9 flex-none items-center rounded-[10px] px-3.5 text-xs font-extrabold ${action.className}`}>
                {action.label}
              </span>
            </TrackedLink>
          )
        })}
      </div>
      <TrackedLink
        eventName="home_card_click"
        eventParams={{ card: 'upcoming_more' }}
        href={`/meet?from=${FROM_HOME_UPCOMING_MORE}`}
        className="mt-3 flex h-10 items-center justify-center gap-[3px] text-[12.5px] font-bold text-tg-600"
      >
        다른 일정도 보기
        <span aria-hidden>›</span>
      </TrackedLink>
    </>
  )
}
