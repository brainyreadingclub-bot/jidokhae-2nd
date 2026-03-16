'use client'

import Link from 'next/link'
import { formatKoreanDate, formatKoreanTime, formatFee } from '@/lib/kst'
import type { Meeting } from '@/types/meeting'

type MeetingCardProps = {
  meeting: Meeting
  confirmedCount: number
  isRegistered: boolean
}

export default function MeetingCard({
  meeting,
  confirmedCount,
  isRegistered,
}: MeetingCardProps) {
  const isFull = confirmedCount >= meeting.capacity

  // Status-based styling
  const borderColor = isRegistered
    ? 'var(--color-accent-500)'
    : isFull
      ? 'var(--color-status-full)'
      : 'var(--color-status-open)'

  const badge = isRegistered
    ? { label: '신청완료', bg: 'var(--color-accent-50)', border: 'var(--color-accent-200)', text: 'text-accent-700' }
    : isFull
      ? { label: '마감', bg: 'color-mix(in srgb, var(--color-error) 6%, transparent)', border: 'color-mix(in srgb, var(--color-error) 20%, transparent)', text: 'text-error' }
      : { label: '모집중', bg: 'var(--color-primary-50)', border: 'var(--color-primary-200)', text: 'text-primary-600' }

  const isDimmed = isRegistered || isFull

  return (
    <Link
      href={`/meetings/${meeting.id}`}
      className="group relative block overflow-hidden rounded-[var(--radius-lg)] transition-all duration-200 hover:-translate-y-0.5"
      style={{
        boxShadow: 'var(--shadow-card)',
        backgroundColor: isDimmed ? 'var(--color-surface-100)' : 'var(--color-surface-50)',
        border: '1px solid var(--color-surface-300)',
        borderLeft: `4px solid ${borderColor}`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = 'var(--shadow-card-hover)'
        e.currentTarget.style.borderRightColor = 'var(--color-primary-200)'
        e.currentTarget.style.borderTopColor = 'var(--color-primary-200)'
        e.currentTarget.style.borderBottomColor = 'var(--color-primary-200)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'var(--shadow-card)'
        e.currentTarget.style.borderRightColor = 'var(--color-surface-300)'
        e.currentTarget.style.borderTopColor = 'var(--color-surface-300)'
        e.currentTarget.style.borderBottomColor = 'var(--color-surface-300)'
      }}
    >
      {/* Badge — top right */}
      <div className="absolute top-3.5 right-4">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${badge.text}`}
          style={{ backgroundColor: badge.bg, border: `1px solid ${badge.border}` }}
        >
          {badge.label}
        </span>
      </div>

      <div className="px-4 py-4">
        {/* Date + Time */}
        <div className="mb-2.5 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold text-primary-700" style={{ backgroundColor: 'var(--color-primary-50)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            {formatKoreanDate(meeting.date)}
          </span>
          <span className="text-xs text-neutral-500 font-medium">
            {formatKoreanTime(meeting.time)}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-sm font-bold text-primary-900 leading-snug pr-16 group-hover:text-primary-600 transition-colors duration-200">
          {meeting.title}
        </h3>

        {/* Details row */}
        <div className="mt-4 flex items-center gap-3 text-xs text-neutral-500">
          {/* Location */}
          <span className="flex items-center gap-1">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {meeting.location}
          </span>

          <span className="h-3 w-px" style={{ backgroundColor: 'var(--color-surface-300)' }} />

          {/* Participant count */}
          <span className="flex items-center gap-1">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            {confirmedCount}/{meeting.capacity}명
          </span>

          <span className="h-3 w-px" style={{ backgroundColor: 'var(--color-surface-300)' }} />

          {/* Fee */}
          <span className="font-bold text-accent-600 tabular-nums">
            {formatFee(meeting.fee)}
          </span>
        </div>
      </div>
    </Link>
  )
}
