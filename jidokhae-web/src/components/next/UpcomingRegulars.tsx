import Link from 'next/link'
import TrackedLink from '@/components/analytics/TrackedLink'
import { Sec } from '@/components/next/TossUI'
import { formatKoreanTime } from '@/lib/kst'

/**
 * 홈 「다가오는 정기모임」 — 최대 3건 (2026-10-13 시안).
 * 데이터는 page가 고른다: regular · active · 오늘 이후 · 내가 신청한 것(취소 제외) 빼고 · 날짜순 3건.
 * 0건이면 page가 빈 배열을 넘기고 이 칸은 통째로 안 그린다.
 *
 * 남은 자리는 3자리 이하일 때만 말한다 — 넉넉할 때 숫자를 보이면 「아무도 안 오나」로 읽힌다.
 * 링크에 `?from=home_upcoming`을 단다 — 「홈에서 온 신청」을 세는 출처 표시.
 */

export type UpcomingRegular = {
  id: string
  date: string
  time: string
  region: string
  venueName: string
  /** 남은 자리. null = 넉넉함(표시 안 함) / 0 = 마감 */
  seatsLeft: number | null
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
          const full = m.seatsLeft === 0
          return (
            <TrackedLink
              key={m.id}
              eventName="home_card_click"
              eventParams={{ card: 'upcoming', position: i + 1, full }}
              href={`/meet/${m.id}?from=home_upcoming`}
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
                <span className="block truncate text-sm font-bold tracking-tight">
                  {m.region} · {m.venueName}
                </span>
                <span className="mt-0.5 block truncate text-xs text-tg-600">
                  {formatKoreanTime(m.time)}
                  {m.seatsLeft !== null && m.seatsLeft > 0 && (
                    <b className="font-bold text-accent-500"> · {m.seatsLeft}자리 남음</b>
                  )}
                </span>
              </span>
              {full ? (
                <span className="flex h-9 flex-none items-center rounded-[10px] bg-tg-100 px-3 text-xs font-bold text-tg-600">
                  마감
                </span>
              ) : (
                <span className="flex h-9 flex-none items-center rounded-[10px] bg-brand-bg px-3.5 text-xs font-extrabold text-brand-deep">
                  신청하기
                </span>
              )}
            </TrackedLink>
          )
        })}
      </div>
      <Link
        href="/meet"
        className="mt-3 flex h-10 items-center justify-center gap-[3px] text-[12.5px] font-bold text-tg-600"
      >
        다른 일정도 보기
        <span aria-hidden>›</span>
      </Link>
    </>
  )
}
