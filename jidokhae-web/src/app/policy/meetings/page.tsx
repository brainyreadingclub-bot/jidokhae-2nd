import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getKSTToday } from '@/lib/kst'
import { getSiteSettings } from '@/lib/site-settings'
import MeetingCard from '@/components/meetings/MeetingCard'
import DateSectionHeader from '@/components/meetings/DateSectionHeader'
import EmptyMeetings from '@/components/meetings/EmptyMeetings'
import type { Meeting } from '@/types/meeting'

export const metadata: Metadata = {
  title: '모임 일정 | 지독해',
  description: '경주·포항 독서모임 지독해 — 다가오는 모임 일정과 참가비를 확인하세요',
}

export default async function PublicMeetingsPage() {
  const supabase = await createClient()
  const settings = await getSiteSettings()
  const regionsLabel = settings['active_regions_label'] ?? '경주 · 포항'
  const kstToday = getKSTToday()

  // 비로그인 공개 페이지 — 민감 컬럼(chat_link/detail_address/reading_link)은
  // 제외하고 공개 안전 컬럼만 명시 (Phase 3 M7 Step 2.5, 검토문서 §4 커밋 4)
  // 신청자에게만 노출되어야 할 카카오톡 오픈채팅 URL이나 상세 주소가
  // API 응답으로 비로그인자에게 전달되는 것을 차단.
  const { data: meetings, error: meetingsError } = await supabase
    .from('meetings')
    .select('id, title, description, date, time, location, venue_id, capacity, fee, status, region, is_featured, created_at, updated_at')
    .eq('status', 'active')
    .gte('date', kstToday)
    .order('date', { ascending: true })
    .order('time', { ascending: true })

  if (meetingsError) {
    throw new Error(`모임 목록 조회 실패: ${meetingsError.message}`)
  }

  const typedMeetings = (meetings ?? []) as Meeting[]

  let countMap = new Map<string, number>()
  if (typedMeetings.length > 0) {
    const meetingIds = typedMeetings.map((m) => m.id)
    const { data: countsResult, error: countsError } = await supabase.rpc(
      'get_confirmed_counts',
      { meeting_ids: meetingIds }
    )
    if (countsError) {
      throw new Error(`참가자 수 조회 실패: ${countsError.message}`)
    }
    countMap = new Map<string, number>(
      (countsResult ?? []).map(
        (c: { meeting_id: string; confirmed_count: number }) => [
          c.meeting_id,
          Number(c.confirmed_count),
        ] as [string, number],
      ),
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* ── Hero Section ── */}
      <section
        className="relative overflow-hidden px-[var(--spacing-page)] pb-12 pt-12"
        style={{ backgroundColor: 'var(--color-primary-900)' }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            opacity: 0.035,
            backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute -top-16 -right-16 h-56 w-56 rounded-full"
            style={{ background: 'radial-gradient(circle, var(--color-accent-400) 0%, transparent 70%)', opacity: 0.07 }}
          />
        </div>
        <div className="relative">
          <p className="text-caption tracking-[0.15em] text-neutral-400">
            {regionsLabel} 독서모임
          </p>
          <h1
            className="mt-3 text-2xl font-bold leading-snug text-white"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            모임 일정
          </h1>
          <div className="mt-4 h-px w-[48px] bg-neutral-600" />
          <p className="mt-4 text-sm leading-relaxed text-neutral-300">
            다가오는 모임 일정을 확인하고, 마음에 드는 모임에 참여해보세요.
          </p>
        </div>
      </section>

      {/* ── Meeting List ── */}
      <section
        className="relative z-10 -mt-4 rounded-t-[20px] px-[var(--spacing-page)] pt-8 pb-6"
        style={{ backgroundColor: 'var(--color-surface-50)' }}
      >
        <p className="mb-5 text-sm text-neutral-500">
          로그인하면 모임에 신청할 수 있어요
        </p>

        {typedMeetings.length === 0 ? (
          <EmptyMeetings />
        ) : (
          <div className="flex flex-col gap-5">
            {(() => {
              const groups: { date: string; meetings: Meeting[] }[] = []
              let curDate = ''
              let curGroup: Meeting[] = []
              for (const m of typedMeetings) {
                if (m.date !== curDate) {
                  if (curGroup.length > 0) groups.push({ date: curDate, meetings: curGroup })
                  curDate = m.date
                  curGroup = [m]
                } else {
                  curGroup.push(m)
                }
              }
              if (curGroup.length > 0) groups.push({ date: curDate, meetings: curGroup })
              return groups.map((group) => (
                <div key={group.date}>
                  <DateSectionHeader date={group.date} kstToday={kstToday} />
                  <div className="flex flex-col gap-3">
                    {group.meetings.map((meeting) => (
                      <MeetingCard
                        key={meeting.id}
                        meeting={meeting}
                        confirmedCount={countMap.get(meeting.id) ?? 0}
                        isRegistered={false}
                        isWaitlisted={false}
                        isPrivileged={false}
                        basePath="/policy/meetings"
                      />
                    ))}
                  </div>
                </div>
              ))
            })()}
          </div>
        )}
      </section>

      {/* ── CTA ── */}
      <section
        className="px-[var(--spacing-page)] pb-10"
        style={{ backgroundColor: 'var(--color-surface-50)' }}
      >
        <div
          className="rounded-[var(--radius-md)] border border-surface-300 px-5 py-4"
          style={{ backgroundColor: 'var(--color-surface-100)' }}
        >
          <p className="text-sm font-medium text-neutral-700">
            모임에 참여하고 싶으신가요?
          </p>
          <Link
            href="/auth/login"
            prefetch={false}
            className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary-600 hover:text-primary-700"
          >
            로그인하고 신청하기
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>
        </div>
      </section>
    </div>
  )
}
