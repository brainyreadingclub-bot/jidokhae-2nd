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
  const isDeleted =
    meeting.status === 'deleted' || meeting.status === 'deleting'

  const cardInner = (
    <>
      {/* Top accent bar */}
      <div
        className="h-1 rounded-t-[var(--radius-lg)]"
        style={{
          background: badge.color === 'success'
            ? 'linear-gradient(90deg, var(--color-primary-500), var(--color-primary-300))'
            : 'linear-gradient(90deg, var(--color-surface-300), var(--color-surface-200))',
        }}
      />
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-primary-900 truncate">
              {meeting.title}
            </h3>
            <div className="mt-1.5 flex items-center gap-2 text-xs text-primary-500/70">
              <span>{formatKoreanDate(meeting.date)}</span>
              <span className="text-primary-300">·</span>
              <span>{formatKoreanTime(meeting.time)}</span>
            </div>
            <div className="mt-1 text-xs text-primary-400">{meeting.location}</div>
          </div>

          <span
            className={`ml-3 inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-tight ${
              badge.color === 'success'
                ? 'bg-primary-50 text-primary-700'
                : 'text-primary-400'
            }`}
            style={
              badge.color === 'success'
                ? { border: '1px solid var(--color-primary-100)' }
                : { backgroundColor: 'var(--color-surface-200)' }
            }
          >
            {badge.label}
          </span>
        </div>

        {registration.paid_amount != null && (
          <div
            className="mt-3 pt-2.5 text-xs text-primary-500/70"
            style={{ borderTop: '1px solid var(--color-surface-300)' }}
          >
            결제금액{' '}
            <span className="font-bold text-accent-600">
              {formatFee(registration.paid_amount)}
            </span>
            {registration.status === 'cancelled' &&
              registration.refunded_amount != null &&
              registration.refunded_amount > 0 && (
                <span className="ml-2 text-primary-400">
                  · 환불{' '}
                  <span className="font-semibold text-primary-600">
                    {formatFee(registration.refunded_amount)}
                  </span>
                </span>
              )}
          </div>
        )}
      </div>
    </>
  )

  // Deleted/deleting meetings: non-clickable card with muted style
  if (isDeleted) {
    return (
      <div
        className="block rounded-[var(--radius-lg)] overflow-hidden opacity-60"
        style={{
          backgroundColor: 'var(--color-surface-100)',
          border: '1px solid var(--color-surface-300)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        {cardInner}
      </div>
    )
  }

  return (
    <Link
      href={`/meetings/${meeting.id}`}
      className="block rounded-[var(--radius-lg)] overflow-hidden transition-all duration-200 hover:-translate-y-0.5"
      style={{
        backgroundColor: 'var(--color-surface-50)',
        border: '1px solid var(--color-surface-300)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      {cardInner}
    </Link>
  )
}
