import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { getProfile } from '@/lib/profile'
import { createServiceClient } from '@/lib/supabase/admin'
import { formatKSTDateTime } from '@/lib/settlement'
import {
  getNotificationLog,
  getNotificationStats,
  notificationTypeLabel,
} from '@/lib/notification-log'
import NotificationLogTabs from '@/components/admin/NotificationLogTabs'

export default async function AdminNotificationsPage() {
  const user = await getUser()
  if (!user) redirect('/auth/login')

  // 회원 연락처와 실명이 노출되므로 admin 전용 (역할 매트릭스 2026-04-23)
  const profile = await getProfile(user.id)
  if (profile.role !== 'admin') redirect('/admin')

  const supabase = createServiceClient()

  const [stats, problemRows, recentRows] = await Promise.all([
    getNotificationStats(supabase),
    getNotificationLog(supabase, ['failed', 'skipped']),
    getNotificationLog(supabase),
  ])

  const summaryCards = [
    { label: '발송됨', value: stats.sent, tone: 'normal' as const },
    { label: '실패', value: stats.failed, tone: stats.failed > 0 ? ('alert' as const) : ('normal' as const) },
    { label: '건너뜀', value: stats.skipped, tone: 'normal' as const },
    { label: '발송 중', value: stats.pending, tone: 'normal' as const },
  ]

  return (
    <div className="px-5 pt-6 pb-10 lg:px-10 lg:pt-10">
      <div className="mb-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-500">
          시스템
        </div>
        <h1
          className="mt-1 text-2xl font-extrabold tracking-tight text-primary-900 lg:text-3xl"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          알림톡 발송 이력
        </h1>
        <p className="mt-1 text-sm text-neutral-500 break-keep">
          회원에게 알림톡이 실제로 도착했는지 확인합니다. 실패가 쌓여 있는데 아무도 모르는
          상황을 막는 것이 이 화면의 목적입니다.
        </p>
      </div>

      {/* 최근 N일 요약 */}
      <section>
        <h2 className="text-sm font-semibold text-neutral-700">
          최근 {stats.windowDays}일 — 총 {stats.total}건
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {summaryCards.map((card) => (
            <div
              key={card.label}
              className="rounded-[var(--radius-md)] border border-neutral-200 bg-white p-4"
            >
              <p className="text-caption text-neutral-500">{card.label}</p>
              <p
                className={[
                  'mt-1 text-2xl font-extrabold',
                  card.tone === 'alert' ? 'text-accent-600' : 'text-neutral-800',
                ].join(' ')}
              >
                {card.value}
              </p>
            </div>
          ))}
        </div>

        {/*
          실패가 지금 나고 있는지, 과거 흔적인지를 갈라서 보여준다.
          누적 수만 빨갛게 띄우면 이미 끝난 사고(2026-03~06월) 때문에 경고가
          영원히 켜져 있게 되고, 상시 점등된 경고는 아무도 보지 않는다.
        */}
        {stats.failed > 0 ? (
          <p className="mt-3 break-keep rounded-[var(--radius-md)] border border-accent-200 bg-accent-50 px-3 py-2 text-xs text-accent-600">
            최근 {stats.windowDays}일 안에 실패가 {stats.failed}건 있습니다. 아래 &lsquo;실패 ·
            건너뜀&rsquo; 탭에서 대상과 시각을 확인하세요.
          </p>
        ) : (
          stats.failedAllTime > 0 && (
            <p className="mt-3 break-keep rounded-[var(--radius-md)] border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
              최근 {stats.windowDays}일은 실패 없이 정상입니다. 전체 기간 누적 실패는{' '}
              {stats.failedAllTime}건이고 마지막 실패는{' '}
              {stats.lastFailedAt ? formatKSTDateTime(stats.lastFailedAt) : '기록 없음'}입니다.
            </p>
          )
        )}
      </section>

      {/* 종류별 내역 */}
      {stats.byType.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-neutral-700">
            종류별 (최근 {stats.windowDays}일)
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                  <th className="py-2 pr-3 font-medium">종류</th>
                  <th className="py-2 pr-3 font-medium">발송됨</th>
                  <th className="py-2 pr-3 font-medium">실패</th>
                  <th className="py-2 pr-3 font-medium">건너뜀</th>
                  <th className="py-2 font-medium">합계</th>
                </tr>
              </thead>
              <tbody>
                {stats.byType.map((row) => (
                  <tr key={row.type} className="border-b border-neutral-100">
                    <td className="py-2 pr-3 text-primary-800">{notificationTypeLabel(row.type)}</td>
                    <td className="py-2 pr-3 text-neutral-700">{row.sent}</td>
                    <td
                      className={[
                        'py-2 pr-3',
                        row.failed > 0 ? 'font-semibold text-accent-600' : 'text-neutral-400',
                      ].join(' ')}
                    >
                      {row.failed}
                    </td>
                    <td className="py-2 pr-3 text-neutral-500">{row.skipped}</td>
                    <td className="py-2 text-neutral-700">{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 상세 목록 */}
      <section className="mt-8">
        <NotificationLogTabs problemRows={problemRows} recentRows={recentRows} />
      </section>
    </div>
  )
}
