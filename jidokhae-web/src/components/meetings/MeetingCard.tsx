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

  return (
    <Link
      href={`/meetings/${meeting.id}`}
      className="group relative block overflow-hidden rounded-[var(--radius-lg)] transition-all duration-200 hover:-translate-y-0.5"
      style={{
        boxShadow: 'var(--shadow-card)',
        backgroundColor: 'var(--color-surface-50)',
        border: '1px solid var(--color-surface-300)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = 'var(--shadow-card-hover)'
        e.currentTarget.style.borderColor = 'var(--color-primary-200)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'var(--shadow-card)'
        e.currentTarget.style.borderColor = 'var(--color-surface-300)'
      }}
    >
      {/* Top accent bar */}
      <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, var(--color-primary-500), var(--color-primary-300))' }} />

      {/* Badge — top right */}
      {(isRegistered || isFull) && (
        <div className="absolute top-4 right-4">
          {isRegistered ? (
            <span className="inline-flex items-center rounded-full bg-primary-50 px-2.5 py-1 text-[11px] font-bold text-primary-700" style={{ border: '1px solid var(--color-primary-200)' }}>
              신청완료
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-error/8 px-2.5 py-1 text-[11px] font-bold text-error">
              마감
            </span>
          )}
        </div>
      )}

      <div className="px-4 py-4">
        {/* Date + Time */}
        <div className="mb-2.5 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold text-primary-700" style={{ backgroundColor: 'var(--color-primary-50)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            {formatKoreanDate(meeting.date)}
          </span>
          <span className="text-xs text-gray-400 font-medium">
            {formatKoreanTime(meeting.time)}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-[15px] font-bold text-primary-900 leading-snug pr-16 group-hover:text-primary-600 transition-colors duration-200">
          {meeting.title}
        </h3>

        {/* Details row */}
        <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
          {/* Location */}
          <span className="flex items-center gap-1">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary-400">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {meeting.location}
          </span>

          <span className="h-3 w-px" style={{ backgroundColor: 'var(--color-surface-300)' }} />

          {/* Participant count */}
          <span className="flex items-center gap-1">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary-400">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            {confirmedCount}명 참여
          </span>

          <span className="h-3 w-px" style={{ backgroundColor: 'var(--color-surface-300)' }} />

          {/* Fee */}
          <span className="font-bold text-accent-600">
            {formatFee(meeting.fee)}
          </span>
        </div>
      </div>
    </Link>
  )
}
