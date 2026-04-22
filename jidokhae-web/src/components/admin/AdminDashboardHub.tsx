import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth'
import { getProfile } from '@/lib/profile'
import {
  getKSTToday,
  getKSTMonth,
  getPrevMonth,
  getMonthRange,
  getWeekLater,
  formatFee,
} from '@/lib/kst'
import {
  getMonthlyRevenue,
  getUpcomingMeetings,
  getMemberStats,
  getAlerts,
  getTransferAlerts,
} from '@/lib/dashboard'

/**
 * /admin 허브 — "30초 안에 오늘 뭐 해야 돼?" 단순화.
 * 긴급 알림 + KPI 3 + 이번 주 모임 간략 + 바로가기.
 * 상세 수치/정산/회원 생애주기는 M10에서 /admin/settlements, /admin/members로 이관.
 */
export default async function AdminDashboardHub() {
  const supabase = await createClient()
  const user = await getUser()
  if (!user) redirect('/auth/login')
  const profile = await getProfile(user.id)
  const isAdmin = profile.role === 'admin'

  const kstToday = getKSTToday()
  const currentMonth = getKSTMonth()
  const prevMonth = getPrevMonth(currentMonth)
  const monthRange = getMonthRange(currentMonth)
  const weekLater = getWeekLater(kstToday)

  const [revenue, upcoming, memberStats, alerts, transferAlerts] = await Promise.all([
    getMonthlyRevenue(supabase, currentMonth, prevMonth),
    getUpcomingMeetings(supabase, kstToday, weekLater),
    getMemberStats(supabase, monthRange.start),
    isAdmin
      ? getAlerts(supabase, currentMonth)
      : Promise.resolve({ deletingCount: 0, deletingMeetings: [], unsettledVenues: [] }),
    isAdmin
      ? getTransferAlerts(supabase)
      : Promise.resolve({ pendingTransferCount: 0, pendingRefundCount: 0 }),
  ])

  const revenueDelta = revenue.netRevenue - revenue.prevNetRevenue
  const hasUrgent =
    alerts.deletingMeetings.length > 0 ||
    alerts.unsettledVenues.length > 0 ||
    transferAlerts.pendingTransferCount > 0 ||
    transferAlerts.pendingRefundCount > 0

  // 오늘 날짜 표기 (간단)
  const [y, m, d] = kstToday.split('-').map((v) => Number(v))
  const weekdays = ['일', '월', '화', '수', '목', '금', '토']
  const dowIdx = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  const dateLabel = `${y}년 ${m}월 ${d}일 (${weekdays[dowIdx]})`

  return (
    <div className="px-5 pt-6 pb-10 lg:px-10 lg:pt-10">
      {/* Header */}
      <div className="mb-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-500">
          대시보드 · {dateLabel}
        </div>
        <h1
          className="mt-1 text-2xl font-extrabold tracking-tight text-primary-900 lg:text-3xl"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          오늘의 운영 현황
        </h1>
      </div>

      {/* 긴급 알림 */}
      {hasUrgent && (
        <div className="mb-6 space-y-2">
          {transferAlerts.pendingTransferCount > 0 && (
            <Link
              href="/admin/meetings"
              className="flex items-center justify-between rounded-[var(--radius-md)] px-4 py-3 text-sm font-medium text-accent-700 transition-colors hover:bg-accent-100"
              style={{ backgroundColor: 'var(--color-accent-50)', border: '1px solid var(--color-accent-200)' }}
            >
              <span className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-accent-600">긴급</span>
                <span>입금 확인 대기 {transferAlerts.pendingTransferCount}건</span>
              </span>
              <span className="text-xs font-bold">처리하기 →</span>
            </Link>
          )}
          {transferAlerts.pendingRefundCount > 0 && (
            <Link
              href="/admin/meetings"
              className="flex items-center justify-between rounded-[var(--radius-md)] px-4 py-3 text-sm font-medium text-accent-700 transition-colors hover:bg-accent-100"
              style={{ backgroundColor: 'var(--color-accent-50)', border: '1px solid var(--color-accent-200)' }}
            >
              <span className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-accent-600">환불</span>
                <span>이체 환불 대기 {transferAlerts.pendingRefundCount}건</span>
              </span>
              <span className="text-xs font-bold">확인하기 →</span>
            </Link>
          )}
          {alerts.deletingMeetings.map((m) => (
            <Link
              key={m.id}
              href={`/admin/meetings/${m.id}`}
              className="flex items-center gap-2 rounded-[var(--radius-md)] px-4 py-3 text-sm font-medium text-error"
              style={{ backgroundColor: 'rgba(181, 64, 58, 0.06)', border: '1px solid rgba(181, 64, 58, 0.15)' }}
            >
              <span className="text-xs font-bold uppercase tracking-wider">환불 미처리</span>
              <span className="truncate">— {m.title}</span>
            </Link>
          ))}
          {alerts.unsettledVenues.map((v) => (
            <div
              key={v.name}
              className="flex items-center gap-2 rounded-[var(--radius-md)] px-4 py-3 text-sm font-medium text-warning"
              style={{ backgroundColor: 'rgba(217, 128, 42, 0.06)', border: '1px solid rgba(217, 128, 42, 0.15)' }}
            >
              <span className="text-xs font-bold uppercase tracking-wider">미정산</span>
              <span>{v.name} 이번 달 정산 필요</span>
            </div>
          ))}
        </div>
      )}

      {/* KPI 3 */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi
          label="이번 주 모임"
          value={String(upcoming.count)}
          unit="건"
          subtext={upcoming.count > 0 ? `평균 신청률 ${upcoming.avgFillRate}%` : '없음'}
        />
        <Kpi
          label="신규 회원 (이번 달)"
          value={String(memberStats.newThisMonth)}
          unit="명"
          subtext={`총 ${memberStats.total}명`}
        />
        <Kpi
          label="이번 달 순매출"
          value={formatFee(revenue.netRevenue)}
          unit="원"
          subtext={
            revenueDelta >= 0
              ? `+${formatFee(revenueDelta)}원 vs 전월`
              : `${formatFee(revenueDelta)}원 vs 전월`
          }
          subtextVariant={revenueDelta >= 0 ? 'up' : 'down'}
        />
      </div>

      {/* 이번 주 모임 + 바로가기 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div
          className="rounded-[var(--radius-md)] p-5"
          style={{ backgroundColor: 'var(--color-surface-50)', border: '1px solid var(--color-surface-300)' }}
        >
          <div className="mb-3 flex items-center justify-between">
            <h2
              className="text-sm font-bold text-primary-800 tracking-tight"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              이번 주 모임
            </h2>
            <Link href="/admin/meetings" className="text-xs font-bold text-accent-600 hover:text-accent-700">
              모임 관리 →
            </Link>
          </div>
          {upcoming.lowFillAlerts.length > 0 && (
            <div className="mb-3 space-y-1">
              {upcoming.lowFillAlerts.map((a) => (
                <p key={a.id} className="text-xs text-warning">
                  ⚠ {a.title} — 신청 {a.confirmed}/{a.capacity}명
                </p>
              ))}
            </div>
          )}
          <p className="text-xs text-primary-500">
            {upcoming.count === 0
              ? '이번 주 예정된 모임이 없습니다'
              : `총 ${upcoming.count}회, 평균 신청률 ${upcoming.avgFillRate}%`}
          </p>
        </div>

        <div
          className="rounded-[var(--radius-md)] p-5"
          style={{ backgroundColor: 'var(--color-surface-50)', border: '1px solid var(--color-surface-300)' }}
        >
          <h2
            className="mb-3 text-sm font-bold text-primary-800 tracking-tight"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            바로가기
          </h2>
          <div className="flex flex-wrap gap-2">
            <Quick href="/admin/meetings/new" primary>＋ 새 모임</Quick>
            <Quick href="/admin/meetings">모임 관리</Quick>
            <Quick href="/admin/members">회원 관리</Quick>
            {isAdmin && <Quick href="/admin/settings">사이트 설정</Quick>}
          </div>

          <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--color-surface-300)' }}>
            <h3 className="mb-2 text-xs font-bold text-primary-500 uppercase tracking-wider">
              프로필 현황
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="text-primary-500">프로필 완성</div>
                <div className="font-bold text-primary-800">
                  {memberStats.profileCompleted}명 (
                  {memberStats.total > 0
                    ? Math.round((memberStats.profileCompleted / memberStats.total) * 100)
                    : 0}
                  %)
                </div>
              </div>
              <div>
                <div className="text-primary-500">전화번호 등록</div>
                <div className="font-bold text-primary-800">
                  {memberStats.phoneRegistered}명 (
                  {memberStats.total > 0
                    ? Math.round((memberStats.phoneRegistered / memberStats.total) * 100)
                    : 0}
                  %)
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Kpi({
  label,
  value,
  unit,
  subtext,
  subtextVariant,
}: {
  label: string
  value: string
  unit: string
  subtext: string
  subtextVariant?: 'up' | 'down'
}) {
  const subtextColor =
    subtextVariant === 'up'
      ? 'text-success'
      : subtextVariant === 'down'
        ? 'text-error'
        : 'text-primary-500/80'

  return (
    <div
      className="rounded-[var(--radius-md)] p-4"
      style={{ backgroundColor: 'var(--color-surface-50)', border: '1px solid var(--color-surface-300)' }}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-500">
        {label}
      </div>
      <div
        className="mt-1 text-3xl font-extrabold tracking-tight text-primary-900"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {value}
        <span className="ml-1 text-sm font-semibold text-primary-500">{unit}</span>
      </div>
      <div className={`mt-2 text-xs font-medium ${subtextColor}`} style={{ fontFamily: 'var(--font-mono)' }}>
        {subtext}
      </div>
    </div>
  )
}

function Quick({
  href,
  children,
  primary,
}: {
  href: string
  children: React.ReactNode
  primary?: boolean
}) {
  const base = 'inline-flex items-center rounded-full px-3 py-1.5 text-xs font-bold transition-colors'
  const style = primary
    ? 'bg-primary-700 text-white hover:bg-primary-800'
    : 'text-primary-700 hover:bg-primary-50'
  const border = primary ? undefined : { border: '1px solid var(--color-surface-300)', backgroundColor: 'var(--color-surface-50)' }
  return (
    <Link href={href} className={`${base} ${style}`} style={border}>
      {children}
    </Link>
  )
}
