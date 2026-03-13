'use client'

import Link from 'next/link'
import { formatKoreanDate, formatKoreanTime, formatFee } from '@/lib/kst'
import type { RegistrationWithMeeting } from '@/types/registration'

type Props = {
  registration: RegistrationWithMeeting
  badge: { label: string; color: 'success' | 'gray' }
}

export default function RegistrationCard({ registration, badge }: Props) {
  const meeting = registration.meetings

  return (
    <Link
      href={`/meetings/${meeting.id}`}
      className="block rounded-[var(--radius-lg)] border border-gray-100 bg-white p-4 transition-all duration-200 hover:-translate-y-0.5"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-gray-900 truncate">
            {meeting.title}
          </h3>
          <div className="mt-1.5 flex items-center gap-2 text-xs text-gray-500">
            <span>{formatKoreanDate(meeting.date)}</span>
            <span className="text-gray-300">·</span>
            <span>{formatKoreanTime(meeting.time)}</span>
          </div>
          <div className="mt-1 text-xs text-gray-400">{meeting.location}</div>
        </div>

        <span
          className={`ml-3 inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            badge.color === 'success'
              ? 'bg-success/10 text-success'
              : 'bg-gray-100 text-gray-500'
          }`}
        >
          {badge.label}
        </span>
      </div>

      {registration.paid_amount != null && (
        <div className="mt-3 border-t border-gray-50 pt-2 text-xs text-gray-500">
          결제금액{' '}
          <span className="font-medium text-primary-600">
            {formatFee(registration.paid_amount)}
          </span>
        </div>
      )}
    </Link>
  )
}
