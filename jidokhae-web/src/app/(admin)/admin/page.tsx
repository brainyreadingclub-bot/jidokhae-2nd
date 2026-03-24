import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/profile'
import { getKSTToday, getKSTMonth, getPrevMonth, getMonthRange, getWeekLater, formatFee } from '@/lib/kst'
import { getMonthlyRevenue, getUpcomingMeetings, getMemberStats, getAlerts, getVenueSettlementData } from '@/lib/dashboard'
import AdminMeetingCard from '@/components/admin/AdminMeetingCard'
import VenueSettlementTable from '@/components/admin/VenueSettlementTable'
import type { Meeting } from '@/types/meeting'

type Props = {
  searchParams: Promise<{ filter?: string }>
}

export default async function AdminPage({ searchParams }: Props) {
  const { filter = 'active' } = await searchParams
  const kstToday = getKSTToday()
  const currentMonth = getKSTMonth()
  const prevMonth = getPrevMonth(currentMonth)
  const monthRange = getMonthRange(currentMonth)
  const weekLater = getWeekLater(kstToday)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const profile = await getProfile(user.id)
  const isAdmin = profile.role === 'admin'

  // 필터별 모임 쿼리
  let meetingsQuery = supabase.from('meetings').select('*')
  if (filter === 'last-month') {
    const prev = getMonthRange(prevMonth)
    meetingsQuery = meetingsQuery.gte('date', prev.start).lt('date', prev.end)
  } else if (filter === 'all') {
    meetingsQuery = meetingsQuery.neq('status', 'deleted')
  } else {
    meetingsQuery = meetingsQuery.in('status', ['active', 'deleting'])
  }
  meetingsQuery = meetingsQuery.order('date', { ascending: false }).order('time', { ascending: false })

  // 대시보드 + 모임 목록 병렬 조회
  const [
    meetingsResult,
    revenue,
    upcoming,
    memberStats,
    alerts,
    venueSettlements,
  ] = await Promise.all([
    meetingsQuery,
    getMonthlyRevenue(supabase, currentMonth, prevMonth),
    getUpcomingMeetings(supabase, kstToday, weekLater),
    getMemberStats(supabase, monthRange.start),
    isAdmin ? getAlerts(supabase, currentMonth) : Promise.resolve({ deletingCount: 0, deletingMeetings: [], unsettledVenues: [] }),
    isAdmin ? getVenueSettlementData(supabase, currentMonth) : Promise.resolve([]),
  ])

  if (meetingsResult.error) {
    throw new Error(`모임 목록 조회 실패: ${meetingsResult.error.message}`)
  }

  const typedMeetings = (meetingsResult.data ?? []) as Meeting[]
  const meetingIds = typedMeetings.map((m) => m.id)

  const { data: counts } = meetingIds.length > 0
    ? await supabase.rpc('get_confirmed_counts', { meeting_ids: meetingIds })
    : { data: [] }

  const countMap = new Map<string, number>(
    ((counts ?? []) as { meeting_id: string; confirmed_count: number }[])
      .map((c) => [c.meeting_id, Number(c.confirmed_count)] as [string, number]),
  )

  const revenueDiff = revenue.netRevenue - revenue.prevNetRevenue

  const filters = [
    { key: 'active', label: '진행 중' },
    { key: 'last-month', label: '지난 달' },
    { key: 'all', label: '전체' },
  ]

  return (
    <div className="px-5 pt-4 pb-6">
      {/* ── 주의 필요 (항상 펼침, 해당 없으면 미표시) ── */}
      {(alerts.deletingCount > 0 || alerts.unsettledVenues.length > 0) && (
        <div className="mb-4 space-y-2">
          {alerts.deletingMeetings.map((m) => (
            <Link
              key={m.id}
              href={`/meetings/${m.id}`}
              className="flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-medium text-error"
              style={{ backgroundColor: 'rgba(181, 64, 58, 0.06)', border: '1px solid rgba(181, 64, 58, 0.15)' }}
            >
              <span>🔴</span>
              <span>환불 미처리 — {m.title}</span>
            </Link>
          ))}
          {alerts.unsettledVenues.map((v) => (
            <div
              key={v.name}
              className="flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-medium text-warning"
              style={{ backgroundColor: 'rgba(217, 128, 42, 0.06)', border: '1px solid rgba(217, 128, 42, 0.15)' }}
            >
              <span>🟡</span>
              <span>{v.name} 이번 달 미정산</span>
            </div>
          ))}
        </div>
      )}

      {/* ── 이번 달 정산 (접기/펼치기) ── */}
      {isAdmin && (
        <details className="mb-3">
          <summary
            className="flex items-center justify-between rounded-[var(--radius-md)] px-4 py-3"
            style={{ backgroundColor: 'var(--color-surface-50)', border: '1px solid var(--color-surface-300)' }}
          >
            <div>
              <span className="text-xs font-bold text-primary-500">이번 달 정산</span>
              <span className="ml-2 text-sm font-bold text-primary-800">순수입 {formatFee(revenue.netRevenue)}원</span>
            </div>
            <svg className="h-4 w-4 text-primary-400 transition-transform [details[open]>&]:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
          </summary>
          <div className="mt-2 rounded-[var(--radius-md)] px-4 py-3" style={{ backgroundColor: 'var(--color-surface-50)', border: '1px solid var(--color-surface-300)' }}>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-xs text-primary-500 mb-1">총 결제</div>
                <div className="text-sm font-bold text-primary-800">{formatFee(revenue.totalPaid)}원</div>
              </div>
              <div>
                <div className="text-xs text-primary-500 mb-1">환불</div>
                <div className="text-sm font-bold text-primary-800">{formatFee(revenue.totalRefunded)}원</div>
              </div>
              <div>
                <div className="text-xs text-primary-500 mb-1">전월 대비</div>
                <div className={`text-sm font-bold ${revenueDiff >= 0 ? 'text-success' : 'text-error'}`}>
                  {revenueDiff >= 0 ? '+' : ''}{formatFee(revenueDiff)}원
                </div>
              </div>
            </div>
            <VenueSettlementTable rows={venueSettlements} month={currentMonth} />
          </div>
        </details>
      )}

      {/* ── 다가오는 모임 ── */}
      {upcoming.count > 0 && (
        <div
          className="mb-3 rounded-[var(--radius-md)] px-4 py-3"
          style={{ backgroundColor: 'var(--color-surface-50)', border: '1px solid var(--color-surface-300)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-primary-500">이번 주 모임</span>
            <span className="text-sm text-primary-800">{upcoming.count}회 · 평균 신청률 {upcoming.avgFillRate}%</span>
          </div>
          {upcoming.lowFillAlerts.length > 0 && (
            <div className="mt-2 space-y-1">
              {upcoming.lowFillAlerts.map((a) => (
                <p key={a.id} className="text-xs text-warning">
                  ⚠ {a.title} — 신청 {a.confirmed}/{a.capacity}명
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 회원 현황 (접기/펼치기) ── */}
      <details className="mb-4">
        <summary
          className="flex items-center justify-between rounded-[var(--radius-md)] px-4 py-3"
          style={{ backgroundColor: 'var(--color-surface-50)', border: '1px solid var(--color-surface-300)' }}
        >
          <div>
            <span className="text-xs font-bold text-primary-500">회원 현황</span>
            <span className="ml-2 text-sm text-primary-800">전체 {memberStats.total}명, 이번 달 +{memberStats.newThisMonth}명</span>
          </div>
          <svg className="h-4 w-4 text-primary-400 transition-transform [details[open]>&]:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
        </summary>
        <div className="mt-2 rounded-[var(--radius-md)] px-4 py-3" style={{ backgroundColor: 'var(--color-surface-50)', border: '1px solid var(--color-surface-300)' }}>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div>
              <div className="text-xs text-primary-500 mb-1">프로필 완성</div>
              <div className="text-sm font-bold text-primary-800">{memberStats.profileCompleted}명 ({memberStats.total > 0 ? Math.round(memberStats.profileCompleted / memberStats.total * 100) : 0}%)</div>
            </div>
            <div>
              <div className="text-xs text-primary-500 mb-1">전화번호 등록</div>
              <div className="text-sm font-bold text-primary-800">{memberStats.phoneRegistered}명 ({memberStats.total > 0 ? Math.round(memberStats.phoneRegistered / memberStats.total * 100) : 0}%)</div>
            </div>
          </div>
        </div>
      </details>

      {/* ── 네비게이션 링크 ── */}
      <div className="space-y-2 mb-5">
        <Link
          href="/admin/members"
          className="flex items-center justify-between rounded-[var(--radius-md)] px-4 py-3 text-sm font-medium text-primary-700 transition-colors hover:bg-primary-50"
          style={{ border: '1px solid var(--color-surface-300)', backgroundColor: 'var(--color-surface-50)' }}
        >
          <span>회원 관리</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
        </Link>
        {isAdmin && (
          <Link
            href="/admin/settings"
            className="flex items-center justify-between rounded-[var(--radius-md)] px-4 py-3 text-sm font-medium text-primary-700 transition-colors hover:bg-primary-50"
            style={{ border: '1px solid var(--color-surface-300)', backgroundColor: 'var(--color-surface-50)' }}
          >
            <span>사이트 설정</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          </Link>
        )}
      </div>

      {/* ── 모임 목록 헤더 + 필터 탭 ── */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-extrabold text-primary-900 tracking-tight">모임 목록</h1>
        <Link
          href="/admin/meetings/new"
          className="inline-flex items-center gap-1.5 rounded-full bg-primary-600 px-4 py-2 text-xs font-bold text-white tracking-wide transition-all hover:bg-primary-700 active:scale-[0.97]"
          style={{ boxShadow: '0 2px 8px rgba(27, 67, 50, 0.2)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          새 모임
        </Link>
      </div>

      {/* 필터 탭 */}
      <div className="flex gap-2 mb-4">
        {filters.map((f) => (
          <Link
            key={f.key}
            href={f.key === 'active' ? '/admin' : `/admin?filter=${f.key}`}
            className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
              filter === f.key
                ? 'bg-primary-600 text-white'
                : 'text-primary-600 hover:bg-primary-50'
            }`}
            style={filter !== f.key ? { border: '1px solid var(--color-surface-300)', backgroundColor: 'var(--color-surface-50)' } : undefined}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {/* 모임 목록 */}
      {typedMeetings.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm text-primary-400">
            {filter === 'active' ? '등록된 모임이 없습니다' : '해당 기간에 모임이 없습니다'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {typedMeetings.map((meeting) => (
            <AdminMeetingCard
              key={meeting.id}
              meeting={meeting}
              confirmedCount={countMap.get(meeting.id) ?? 0}
              kstToday={kstToday}
            />
          ))}
        </div>
      )}
    </div>
  )
}
