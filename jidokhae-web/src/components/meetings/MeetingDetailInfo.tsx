import { formatKoreanDate, formatKoreanTime, formatFee } from '@/lib/kst'
import type { Meeting } from '@/types/meeting'

type Props = {
  meeting: Meeting
  confirmedCount: number
  capacity: number
}

export default function MeetingDetailInfo({ meeting, confirmedCount, capacity }: Props) {
  const isFull = confirmedCount >= capacity
  const isAlmostFull = !isFull && confirmedCount >= capacity * 0.8
  const capacityClass = isFull
    ? 'text-neutral-400'
    : isAlmostFull
      ? 'text-accent-500'
      : 'text-primary-600'

  return (
    <div className="space-y-6">
      {/* Title */}
      <h1 className="text-xl font-extrabold text-primary-900 leading-snug tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
        {meeting.title}
      </h1>

      {/* Info grid */}
      <div
        className="rounded-[var(--radius-lg)] p-4 space-y-0"
        style={{
          backgroundColor: 'var(--color-surface-100)',
          border: '1px solid var(--color-surface-300)',
        }}
      >
        <InfoRow
          icon={
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          }
          label="날짜"
          value={formatKoreanDate(meeting.date)}
        />
        <InfoRow
          icon={
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          }
          label="시간"
          value={formatKoreanTime(meeting.time)}
        />
        <InfoRow
          icon={
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          }
          label="장소"
          value={meeting.location}
        />
        <InfoRow
          icon={
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          }
          label="참여"
          value={`${confirmedCount}/${capacity}명`}
          valueClassName={`${capacityClass} font-mono tabular-nums`}
        />
        <InfoRow
          icon={
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          }
          label="참가비"
          value={formatFee(meeting.fee)}
          highlight
          isLast
        />
      </div>
    </div>
  )
}

function InfoRow({
  icon,
  label,
  value,
  highlight,
  isLast,
  valueClassName,
}: {
  icon: React.ReactNode
  label: string
  value: string
  highlight?: boolean
  isLast?: boolean
  valueClassName?: string
}) {
  return (
    <div
      className={`flex items-center gap-3 py-2.5 ${!isLast ? '' : ''}`}
      style={!isLast ? { borderBottom: '1px solid var(--color-surface-300)' } : undefined}
    >
      <span className="text-primary-400 flex-shrink-0">{icon}</span>
      <span className="text-xs font-medium text-primary-500/70 w-11 flex-shrink-0">{label}</span>
      <span
        className={`text-sm font-semibold ${valueClassName || (highlight ? 'text-accent-600' : 'text-primary-800')}`}
      >
        {value}
      </span>
    </div>
  )
}
