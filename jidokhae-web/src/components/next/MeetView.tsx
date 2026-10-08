import Link from 'next/link'
import { Sec, BoxWhite, Chevron } from '@/components/next/TossUI'
import { formatKoreanDate, formatKoreanTime, formatMeetingFee } from '@/lib/kst'

/**
 * 모임 탭 표현 (전면개편 스펙 §2 — "언제 어디서 만나나?").
 * 유형은 형태로 구분: 정기 = 날짜 축 행 / 토론 = 카드 한 장 (2026-08-14 결정).
 * 번개는 2단계 — 이 화면에 아직 없음.
 * 상세는 같은 탭 하위 `/meet/[id]` (2026-08-25 신설). 결제 버튼은 구 화면과 같은
 * MeetingActionButton을 스킨만 바꿔 쓴다 — 돈 흐름 코드는 한 벌이다 (스펙 §6).
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
    /** 참여 자격 미충족 — 카드는 그대로 두고 맨 아래 한 줄만 붙인다 */
    locked: boolean
  } | null
}

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'] as const

function dayParts(date: string): { day: number; weekday: string } {
  const d = new Date(date + 'T00:00:00')
  return { day: d.getDate(), weekday: WEEKDAY[d.getDay()] }
}

export default function MeetView({
  data,
  showLockContext = false,
}: {
  data: MeetData
  /** 잠금 안내에서 넘어왔을 때만 — 도착한 사람이 왜 여기 왔는지 잊지 않게 */
  showLockContext?: boolean
}) {
  const { mine, regular, discussion } = data

  return (
    <div className="pt-2">
      <h1 className="mt-3 text-[21px] font-extrabold leading-[1.3] tracking-[-0.03em] text-tg-900">
        이번 주엔
        <br />
        어디서 볼까요
      </h1>

      {/* 도착 스트립 — 브랜드 그린을 쓰지 않는다. 연그린은 "내가 신청한 것"의 색이라
          여기 쓰면 신청한 줄 안다. 자격이 생기면 스스로 사라지므로 닫기 버튼도 없다 */}
      {showLockContext && (
        <p className="mt-3.5 rounded-[12px] bg-tg-100 px-3.5 py-2.5 text-xs text-tg-700">
          정기모임에 한 번 다녀오면 토론모임 신청이 열려요
        </p>
      )}

      {/* 내 신청 스트립 */}
      {mine && (
        <Link
          href={`/meet/${mine.id}`}
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
          <span className={`flex-none text-[11px] font-bold ${mine.waitlisted ? 'text-tg-600' : 'text-brand-deep'}`}>
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
                href={`/meet/${m.id}`}
                className="flex min-h-[60px] items-center gap-3 border-t border-tg-100 py-3 first:border-t-0"
              >
                <span className="w-10 flex-none text-center">
                  <span className="block text-base font-extrabold tracking-tight tabular-nums">
                    {day}
                  </span>
                  <span className="block text-[9.5px] font-semibold text-tg-600">
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
                    {formatMeetingFee(m.fee)}
                  </span>
                  <span className="block text-[10px] text-tg-600">참가비</span>
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
              {/* 미자격자에게 날짜 줄이 그린이 아니다 — 그린은 "신청이 열려 있다"는 신호다.
                  그 한 가지와 아래 한 줄 말고는 자격자 카드와 전부 같다 (흐리기·자물쇠 금지) */}
              <span
                className={`block text-[10.5px] font-extrabold ${
                  discussion.locked ? 'text-tg-500' : 'text-brand'
                }`}
              >
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
          {discussion.locked && (
            <p className="mt-3 border-t border-tg-100 pt-3 text-xs text-tg-600">
              정기모임에 한 번 다녀오면 신청할 수 있어요
            </p>
          )}
        </BoxWhite>
      ) : (
        <p className="mt-2 rounded-[14px] bg-tg-50 p-4 text-center text-xs text-tg-600">
          다음 토론모임을 준비하고 있어요
        </p>
      )}
    </div>
  )
}
