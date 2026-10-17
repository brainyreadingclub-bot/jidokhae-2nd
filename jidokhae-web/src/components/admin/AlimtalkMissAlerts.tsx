import Link from 'next/link'
import { formatKSTDateTime, formatMonthDay } from '@/lib/kst'
import type { MissAlerts } from '@/lib/alimtalk-miss-server'

/**
 * 대시보드 긴급 칸 — 알림톡 못 받은 회원이 있는 모임마다 한 줄 + 점검이 멈췄을 때 한 줄 (2026-10-17).
 * 다 받았으면 아무것도 그리지 않는다 — 늘 켜져 있는 경고는 아무도 안 본다(2026-08-13 결정과 같은 이유).
 */
export default function AlimtalkMissAlerts({ alerts }: { alerts: MissAlerts }) {
  return (
    <>
      {alerts.meetings.map((m) => (
        <Link
          key={`miss-${m.meetingId}`}
          href={`/admin/meetings/${m.meetingId}`}
          className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] px-4 py-3 text-sm font-medium text-accent-700 transition-colors hover:bg-accent-100"
          style={{ backgroundColor: 'var(--color-accent-50)', border: '1px solid var(--color-accent-200)' }}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="flex-none text-xs font-bold uppercase tracking-wider text-accent-600">알림</span>
            <span className="min-w-0 break-keep">
              {formatMonthDay(m.date)} {m.region ?? ''} — {m.participants}명 중 {m.missedPeople}명에게 알림톡이 안 갔어요
            </span>
          </span>
          <span className="flex-none text-xs font-bold">명단 보기 →</span>
        </Link>
      ))}
      {/* 크론이 아예 안 돌면 실패 기록도 안 생긴다 — 마지막 점검 시각으로 잡는다 */}
      {alerts.runStale && alerts.lastRunAt && (
        <div
          className="flex items-center gap-2 rounded-[var(--radius-md)] px-4 py-3 text-sm font-medium text-accent-700"
          style={{ backgroundColor: 'var(--color-accent-50)', border: '1px solid var(--color-accent-200)' }}
        >
          <span className="flex-none text-xs font-bold uppercase tracking-wider text-accent-600">점검</span>
          <span className="break-keep">
            모임 전날 알림 점검이 하루 넘게 없었어요 (마지막 {formatKSTDateTime(alerts.lastRunAt)})
          </span>
        </div>
      )}
    </>
  )
}
