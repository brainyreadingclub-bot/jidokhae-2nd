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
      className={`block rounded-[var(--radius-md)] border border-gray-100 bg-white px-4 py-3 transition-colors hover:bg-gray-50 ${
        isPast ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-gray-900 truncate">
            {meeting.title}
          </h3>
          <p className="mt-1 text-xs text-gray-500">
            {formatKoreanDate(meeting.date)} {formatKoreanTime(meeting.time)}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-gray-500">
            {confirmedCount}명 신청
          </span>
          {meeting.status === 'deleting' && (
            <span className="inline-flex items-center rounded-full bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning">
              환불 미처리
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
