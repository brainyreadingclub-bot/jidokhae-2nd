import Link from 'next/link'
import { Sec, BoxWhite, Chevron } from '@/components/next/TossUI'
import { formatKoreanDate, formatKoreanTime, formatFee } from '@/lib/kst'

/**
 * 모임 탭 표현 (전면개편 스펙 §2 — "언제 어디서 만나나?").
 * 유형은 형태로 구분: 정기 = 날짜 축 행 / 토론 = 카드 한 장 (2026-08-14 결정).
 * 번개는 2단계 — 이 화면에 아직 없음.
 * 상세·신청은 구경로(/meetings/[id]) 재사용 — 결제 로직 무변경 (스펙 §6).
 */

export type MeetData = {
  /** 내가 신청한 가장 가까운 모임 (스트립). waitlisted = 대기 중 (확정 아님) */
  mine: { id: string; title: string; date: string; daysLeft: number; waitlisted: boolean } | null
  regular: {
    id: string
    date: string
    time: string
    venueName: string
    confirmedLabel: string
    fee: number
  }[]
  discussion: {
    id: string
    title: string
    date: string
    time: string
    venueName: string
    open: boolean
    /** 연결된 책 (2026-08-18 표지 배치 — 토론은 표지가 얼굴, 56×84) */
    thumbnail: string | null
    authors: string | null
  } | null
}

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'] as const

function dayParts(date: string): { day: number; weekday: string } {
  const d = new Date(date + 'T00:00:00')
  return { day: d.getDate(), weekday: WEEKDAY[d.getDay()] }
}

export default function MeetView({ data }: { data: MeetData }) {
  const { mine, regular, discussion } = data

  return (
    <div className="pt-2">
      <h1 className="mt-3 text-[21px] font-extrabold leading-[1.3] tracking-[-0.03em] text-tg-900">
        이번 주엔
        <br />
        어디서 볼까요
      </h1>

      {/* 내 신청 스트립 */}
      {mine && (
        <Link
          href={`/meetings/${mine.id}`}
          className={`mt-4 flex min-h-[46px] items-center gap-2.5 rounded-[12px] px-3.5 py-2.5 ${mine.waitlisted ? 'bg-tg-50' : 'bg-brand-bg'}`}
        >
          <span
            className={`flex h-4.5 w-4.5 flex-none items-center justify-center rounded-full text-[9px] font-bold text-white ${mine.waitlisted ? 'bg-tg-400' : 'bg-brand'}`}
          >
            {mine.waitlisted ? '…' : '✓'}
          </span>
          <span className="min-w-0 flex-1 truncate text-xs text-tg-700">
            <b className={`font-bold ${mine.waitlisted ? 'text-tg-700' : 'text-brand-deep'}`}>
              {mine.waitlisted ? '대기 중인 모임' : '신청한 모임'}
            </b>{' '}
            {formatKoreanDate(mine.date)} · {mine.title}
          </span>
          <span className={`flex-none text-[11px] font-bold ${mine.waitlisted ? 'text-tg-500' : 'text-brand-deep'}`}>
            {mine.waitlisted ? '대기 중' : mine.daysLeft === 0 ? '오늘' : `D-${mine.daysLeft}`}
          </span>
          <Chevron />
        </Link>
      )}

      {/* 정기모임 — 날짜 축 행 */}
      <Sec aside={`${regular.length}건`}>정기모임</Sec>
      {regular.length === 0 ? (
        <p className="mt-2 rounded-[14px] bg-tg-50 p-4 text-center text-xs text-tg-600">
          예정된 정기모임이 아직 없어요
        </p>
      ) : (
        <div>
          {regular.map((m) => {
            const { day, weekday } = dayParts(m.date)
            return (
              <Link
                key={m.id}
                href={`/meetings/${m.id}`}
                className="flex min-h-[60px] items-center gap-3 border-t border-tg-100 py-3 first:border-t-0"
              >
                <span className="w-10 flex-none text-center">
                  <span className="block text-base font-extrabold tracking-tight tabular-nums">
                    {day}
                  </span>
                  <span className="block text-[9.5px] font-semibold text-tg-400">
                    {weekday}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold tracking-tight">
                    {m.venueName}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-tg-600">
                    {formatKoreanTime(m.time)} · {m.confirmedLabel}
                  </span>
                </span>
                <span className="flex-none text-right">
                  <span className="block text-[13px] font-bold tabular-nums">
                    {formatFee(m.fee)}
                  </span>
                  <span className="block text-[10px] text-tg-400">참가비</span>
                </span>
              </Link>
            )
          })}
        </div>
      )}

      {/* 토론모임 — 카드 한 장 */}
      <Sec aside="월 1회">토론모임</Sec>
      {discussion ? (
        <BoxWhite>
          <Link href="/talk" className="flex items-center gap-3.5">
            {discussion.thumbnail && (
              <img
                src={discussion.thumbnail}
                alt={discussion.title}
                width={56}
                height={84}
                className="h-[84px] w-[56px] flex-none rounded-[5px] object-cover"
                style={{ boxShadow: '0 0 0 1px rgba(0,0,0,.06), 0 4px 10px rgba(25,31,40,.16)' }}
              />
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-[10.5px] font-extrabold text-brand">
                {formatKoreanDate(discussion.date)} {formatKoreanTime(discussion.time)}
                {!discussion.open && ' · 신청 마감'}
              </span>
              <span className="mt-0.5 block truncate text-[15px] font-extrabold tracking-tight">
                {discussion.title}
              </span>
              <span className="mt-0.5 block truncate text-xs text-tg-600">
                {[discussion.authors, discussion.venueName].filter(Boolean).join(' · ')}
              </span>
            </span>
            <Chevron />
          </Link>
        </BoxWhite>
      ) : (
        <p className="mt-2 rounded-[14px] bg-tg-50 p-4 text-center text-xs text-tg-600">
          다음 토론모임을 준비하고 있어요
        </p>
      )}
    </div>
  )
}
