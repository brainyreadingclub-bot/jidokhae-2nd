import Link from 'next/link'
import { formatKoreanDate, formatKoreanTime } from '@/lib/kst'
import type { Meeting } from '@/types/meeting'

type Props = {
  meeting: Meeting
  confirmedCount: number
  kstToday: string
}

export default function AdminMeetingCard({ meeting, confirmedCount, kstToday }: Props) {
  const isPast = meeting.date < kstToday

  return (
    <Link
      href={`/meetings/${meeting.id}`}
      className={`block rounded-[var(--radius-md)] px-4 py-3.5 transition-all hover:-translate-y-0.5 ${
        isPast ? 'opacity-55' : ''
      }`}
      style={{
        backgroundColor: 'var(--color-surface-50)',
        border: '1px solid var(--color-surface-300)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-primary-900 truncate">
            {meeting.title}
          </h3>
          <p className="mt-1 text-xs text-primary-500/70">
            {formatKoreanDate(meeting.date)} {formatKoreanTime(meeting.time)}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs font-medium text-primary-500">
            {confirmedCount}명 신청
          </span>
          {meeting.status === 'deleting' && (
            <span
              className="inline-flex items-center rounded-full bg-accent-50 px-2 py-0.5 text-[11px] font-bold text-warning"
              style={{ border: '1px solid var(--color-accent-200)' }}
            >
              환불 미처리
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
