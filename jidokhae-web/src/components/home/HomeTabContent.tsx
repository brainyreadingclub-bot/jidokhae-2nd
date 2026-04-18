import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth'
import { getProfile } from '@/lib/profile'
import {
  getKSTToday,
  getTomorrowKST,
  formatKoreanDate,
  formatKoreanTime,
} from '@/lib/kst'
import type { Meeting } from '@/types/meeting'

/**
 * /home 탭 — Phase 3 M9 4섹션이 도착하기 전 minimum viable 홈.
 * 규칙: "없으면 안 그린다" — 데이터 없는 섹션은 자동 미렌더.
 *
 * M7 시점 노출 가능한 것:
 *  - 환영 인사 (always)
 *  - 오늘/내일 D-Day 입장권 (현재 user의 confirmed 있으면)
 *  - 다가오는 모임 미리보기 (active 모임 있으면, 없으면 빈 카드)
 *  - 모임 일정 CTA (always)
 *
 * M8 도착 시: 배너 (banners.is_active=true 데이터 있으면 자동 추가)
 * M9 도착 시: 한 줄 / 합류 티커 (book_quotes + 통계 자동 추가)
 *
 * (기존 components/home/HomeContent.tsx는 모임 일정 페이지(/) 용도라 별도 이름 유지)
 */
export default async function HomeTabContent() {
  const supabase = await createClient()
  const user = await getUser()
  if (!user) redirect('/auth/login')

  const profile = await getProfile(user.id)
  const today = getKSTToday()
  const tomorrow = getTomorrowKST()

  // 1) 회원의 confirmed 중 오늘/내일 모임 (D-Day 입장권)
  // 2) 다가오는 active 모임 가까운 순 3개 (banner fallback)
  const [dDayResult, upcomingResult] = await Promise.all([
    supabase
      .from('registrations')
      .select('id, meetings!inner(id, title, date, time, location, status)')
      .eq('user_id', user.id)
      .eq('status', 'confirmed'),
    supabase
      .from('meetings')
      .select('*')
      .eq('status', 'active')
      .gte('date', today)
      .order('date', { ascending: true })
      .order('time', { ascending: true })
      .limit(3),
  ])

  const dDayMeetings = ((dDayResult.data ?? []) as unknown as {
    meetings: Meeting | null
  }[])
    .map((r) => r.meetings)
    .filter((m): m is Meeting => m !== null && (m.date === today || m.date === tomorrow))
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))

  const upcomingMeetings = (upcomingResult.data ?? []) as Meeting[]

  // 정원 카운트 (다가오는 모임용)
  const upcomingIds = upcomingMeetings.map((m) => m.id)
  const { data: counts } = upcomingIds.length > 0
    ? await supabase.rpc('get_confirmed_counts', { meeting_ids: upcomingIds })
    : { data: [] }

  const countMap = new Map<string, number>(
    ((counts ?? []) as { meeting_id: string; confirmed_count: number }[])
      .map((c) => [c.meeting_id, Number(c.confirmed_count)] as [string, number]),
  )

  const heroCopy = pickHeroCopy(dDayMeetings.length > 0, upcomingMeetings.length > 0)
  const dateLabel = formatTodayLabel(today)

  return (
    <>
      {/* 인사 */}
      <header className="mb-5">
        <p
          className="text-sm font-bold text-primary-900"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {profile.nickname || '회원'}님, 안녕하세요
        </p>
        <p className="mt-0.5 text-xs text-primary-500">
          {profile.region ? `${profile.region} · ` : ''}{dateLabel}
        </p>
      </header>

      {/* Hero */}
      <section className="mb-5">
        <h1
          className="text-lg font-bold tracking-tight text-primary-900 leading-snug"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {heroCopy.title}
        </h1>
        <p className="mt-1 text-xs text-primary-600">{heroCopy.sub}</p>
      </section>

      {/* 오늘/내일 모임 — 있을 때만 */}
      {dDayMeetings.length > 0 && (
        <section className="mb-5">
          <SectionHeader title="오늘 / 내일 모임" />
          <div className="space-y-2">
            {dDayMeetings.slice(0, 2).map((m) => (
              <DDayTicket key={m.id} meeting={m} isToday={m.date === today} />
            ))}
          </div>
        </section>
      )}

      {/* 다가오는 모임 — 있을 때만 (없으면 빈 카드) */}
      <section className="mb-5">
        <SectionHeader title="다가오는 모임" actionLabel="전체 보기" actionHref="/" />
        {upcomingMeetings.length > 0 ? (
          <div className="space-y-2">
            {upcomingMeetings.map((m) => (
              <UpcomingMeetingCard
                key={m.id}
                meeting={m}
                confirmedCount={countMap.get(m.id) ?? 0}
              />
            ))}
          </div>
        ) : (
          <EmptyMeetingsCard />
        )}
      </section>

      {/* CTA — always */}
      <section
        className="rounded-[var(--radius-md)] px-4 py-4 text-center"
        style={{
          backgroundColor: 'var(--color-primary-50)',
          border: '1px solid var(--color-primary-100)',
        }}
      >
        <p className="text-xs text-primary-700">전체 일정도 한 번에</p>
        <Link
          href="/"
          className="mt-1.5 inline-flex items-center gap-1 text-sm font-bold text-primary-700 hover:text-primary-800"
        >
          모임 일정 보러가기
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>
      </section>
    </>
  )
}

function pickHeroCopy(hasDDay: boolean, hasUpcoming: boolean) {
  if (hasDDay) {
    return {
      title: '오늘 / 내일 모임이 기다리고 있어요',
      sub: '입장권을 확인하고 마음의 준비를 해 보세요.',
    }
  }
  if (hasUpcoming) {
    return {
      title: '이번 주, 가까운 모임을 모았어요',
      sub: '마음에 드는 책으로 시작해 보세요.',
    }
  }
  return {
    title: '잠깐 쉬어가는 한 주',
    sub: '곧 다음 일정이 올라와요. 좋은 책과 함께 기다려 보세요.',
  }
}

function formatTodayLabel(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map((v) => Number(v))
  const weekdays = ['일', '월', '화', '수', '목', '금', '토']
  const dow = weekdays[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  return `${m}월 ${d}일 (${dow})`
}

function SectionHeader({
  title,
  actionLabel,
  actionHref,
}: {
  title: string
  actionLabel?: string
  actionHref?: string
}) {
  return (
    <div className="mb-2 flex items-baseline justify-between">
      <h2
        className="text-sm font-bold text-primary-900 tracking-tight"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {title}
      </h2>
      {actionLabel && actionHref && (
        <Link href={actionHref} className="text-xs font-bold text-accent-500 hover:text-accent-600">
          {actionLabel} →
        </Link>
      )}
    </div>
  )
}

function DDayTicket({ meeting, isToday }: { meeting: Meeting; isToday: boolean }) {
  return (
    <Link
      href={`/meetings/${meeting.id}`}
      className="block rounded-[var(--radius-md)] px-4 py-3 transition-shadow hover:shadow-md"
      style={{
        backgroundColor: 'var(--color-surface-50)',
        border: '1.5px solid var(--color-primary-900)',
      }}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <span
          className="rounded px-2 py-0.5 text-[11px] font-bold tracking-wider text-white"
          style={{
            backgroundColor: 'var(--color-accent-500)',
            fontFamily: 'var(--font-display)',
          }}
        >
          {isToday ? 'D-DAY' : 'D-1'}
        </span>
        <div className="text-right text-[11px] text-primary-500">
          <div className="font-semibold text-primary-900">{formatKoreanDate(meeting.date)}</div>
          <div>{formatKoreanTime(meeting.time)}</div>
        </div>
      </div>
      <h3
        className="mb-1.5 text-sm font-bold text-primary-900 leading-snug"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {meeting.title}
      </h3>
      <p className="text-[11px] text-primary-700">📍 {meeting.location}</p>
    </Link>
  )
}

function UpcomingMeetingCard({
  meeting,
  confirmedCount,
}: {
  meeting: Meeting
  confirmedCount: number
}) {
  const fillRate = meeting.capacity > 0 ? confirmedCount / meeting.capacity : 0
  const isFull = confirmedCount >= meeting.capacity
  const isClosing = !isFull && fillRate >= 0.8

  const borderColor = isFull
    ? 'var(--color-status-full)'
    : isClosing
      ? 'var(--color-status-closing)'
      : 'var(--color-status-open)'
  const capColor = isFull
    ? 'text-neutral-500'
    : isClosing
      ? 'text-warning'
      : 'text-primary-600'

  return (
    <Link
      href={`/meetings/${meeting.id}`}
      className="relative block rounded-[var(--radius-md)] px-4 py-3 transition-all hover:-translate-y-0.5"
      style={{
        backgroundColor: 'var(--color-surface-50)',
        border: '1px solid var(--color-surface-300)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <span
        className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r"
        style={{ backgroundColor: borderColor }}
      />
      <h3
        className="mb-1 pl-1.5 text-[13px] font-bold text-primary-900 leading-snug"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {meeting.title}
      </h3>
      <div className="flex items-center justify-between pl-1.5 text-[11px] text-primary-500">
        <span>
          {formatKoreanDate(meeting.date)} {formatKoreanTime(meeting.time)} · {meeting.location}
        </span>
        <span className={`font-bold ${capColor}`}>
          {confirmedCount}/{meeting.capacity}
        </span>
      </div>
    </Link>
  )
}

function EmptyMeetingsCard() {
  return (
    <div
      className="rounded-[var(--radius-md)] px-4 py-6 text-center"
      style={{
        backgroundColor: 'var(--color-surface-50)',
        border: '1px dashed var(--color-neutral-300)',
      }}
    >
      <p
        className="text-sm font-medium text-primary-700"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        다가오는 모임이 없어요
      </p>
      <p className="mt-1 text-xs text-primary-500">
        새 일정이 등록되면 여기서 가장 먼저 안내해 드려요
      </p>
    </div>
  )
}
