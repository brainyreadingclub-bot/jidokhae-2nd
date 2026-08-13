import { formatKSTDateTime } from '@/lib/settlement'
import { notificationTypeLabel, notificationStatusLabel, LOG_PAGE_SIZE } from '@/lib/notification-log'
import type { NotificationLogRow } from '@/lib/notification-log'

type Props = {
  rows: NotificationLogRow[]
  emptyMessage: string
}

const STATUS_CLASSES: Record<string, string> = {
  sent: 'bg-primary-50 text-primary-700 border-primary-200',
  failed: 'bg-accent-50 text-accent-600 border-accent-200',
  skipped: 'bg-neutral-100 text-neutral-600 border-neutral-200',
  pending: 'bg-neutral-100 text-neutral-500 border-neutral-200',
}

function StatusPill({ status }: { status: string }) {
  const classes = STATUS_CLASSES[status] ?? STATUS_CLASSES.pending
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${classes}`}
    >
      {notificationStatusLabel(status)}
    </span>
  )
}

// "YYYY-MM-DD" → "M/D"
function formatMeetingDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const parts = dateStr.split('-')
  if (parts.length < 3) return dateStr
  return `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}`
}

export default function NotificationLogTable({ rows, emptyMessage }: Props) {
  if (rows.length === 0) {
    return <p className="py-12 text-center text-sm text-neutral-400">{emptyMessage}</p>
  }

  return (
    <div>
      {/* 모바일 카드 */}
      <div className="md:hidden space-y-2">
        {rows.map((row) => (
          <div
            key={row.id}
            className="rounded-[var(--radius-md)] p-3"
            style={{
              backgroundColor: 'var(--color-surface-50)',
              border: '1px solid var(--color-surface-200)',
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium text-primary-800">
                {notificationTypeLabel(row.type)}
              </span>
              <StatusPill status={row.status} />
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-neutral-500">
              <span className="truncate">{row.nickname}</span>
              {row.realName && <span className="shrink-0 text-neutral-400">{row.realName}</span>}
            </div>
            <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-neutral-400">
              <span className="truncate">
                {row.meetingTitle ? `${formatMeetingDate(row.meetingDate)} ${row.meetingTitle}` : '모임 없음'}
              </span>
              <span className="shrink-0">{formatKSTDateTime(row.createdAt)}</span>
            </div>
            {row.errorMessage && (
              <p className="mt-2 break-keep rounded bg-accent-50 px-2 py-1 text-[11px] text-accent-600">
                {row.errorMessage}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* 데스크톱 테이블 */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
              <th className="py-2 pr-3 font-medium">발송 시각</th>
              <th className="py-2 pr-3 font-medium">종류</th>
              <th className="py-2 pr-3 font-medium">상태</th>
              <th className="py-2 pr-3 font-medium">닉네임</th>
              <th className="py-2 pr-3 font-medium">실명</th>
              <th className="py-2 pr-3 font-medium">연락처</th>
              <th className="py-2 pr-3 font-medium">모임</th>
              <th className="py-2 font-medium">실패 사유</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-neutral-100 align-top">
                <td className="whitespace-nowrap py-2 pr-3 text-neutral-500">
                  {formatKSTDateTime(row.createdAt)}
                </td>
                <td className="whitespace-nowrap py-2 pr-3 text-primary-800">
                  {notificationTypeLabel(row.type)}
                </td>
                <td className="py-2 pr-3">
                  <StatusPill status={row.status} />
                </td>
                <td className="py-2 pr-3 text-neutral-700">{row.nickname}</td>
                <td className="py-2 pr-3 text-neutral-500">{row.realName ?? '—'}</td>
                <td className="whitespace-nowrap py-2 pr-3 text-neutral-500">
                  {row.recipientPhone || '—'}
                </td>
                <td className="py-2 pr-3 text-neutral-500">
                  {row.meetingTitle ? (
                    <span>
                      <span className="text-neutral-400">{formatMeetingDate(row.meetingDate)}</span>{' '}
                      {row.meetingTitle}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="py-2 break-keep text-accent-600">{row.errorMessage ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length >= LOG_PAGE_SIZE && (
        <p className="mt-3 text-[11px] text-neutral-400">
          최근 {LOG_PAGE_SIZE}건만 표시합니다. 더 오래된 이력은 Supabase에서 직접 조회하세요.
        </p>
      )}
    </div>
  )
}
