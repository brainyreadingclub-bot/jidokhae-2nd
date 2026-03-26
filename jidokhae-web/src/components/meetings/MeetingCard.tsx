'use client'

import Link from 'next/link'
import { formatKoreanDate, formatKoreanTime, formatFee } from '@/lib/kst'
import type { Meeting } from '@/types/meeting'

type MeetingCardProps = {
  meeting: Meeting
  confirmedCount: number
  isRegistered: boolean
  isWaitlisted?: boolean
  basePath?: string
}

export default function MeetingCard({
  meeting,
  confirmedCount,
  isRegistered,
  isWaitlisted,
  basePath = '/meetings',
}: MeetingCardProps) {
  const isFull = confirmedCount >= meeting.capacity
  const isAlmostFull = !isFull && confirmedCount >= meeting.capacity * 0.8

  // Status-based left border color
  const borderColor = isRegistered
    ? 'var(--color-accent-500)'
    : isWaitlisted
      ? 'var(--color-accent-400)'
      : isFull
        ? 'var(--color-status-full)'
        : 'var(--color-status-open)'

  // Status badge config (priority: registered > waitlisted > full > default)
  const badge = isRegistered
    ? { label: '신청완료', classes: 'bg-accent-50 text-accent-700 border-accent-200' }
    : isWaitlisted
      ? { label: '대기 중', classes: 'bg-accent-50 text-accent-600 border-accent-200' }
      : isFull
        ? { label: '마감', classes: 'bg-neutral-100 text-neutral-500 border-neutral-200' }
        : { label: '모집중', classes: 'bg-primary-50 text-primary-700 border-primary-200' }

  // Capacity color
  const capacityClass = isFull
    ? 'text-neutral-400'
    : isAlmostFull
      ? 'text-accent-500'
      : 'text-primary-600'

  return (
    <Link
      href={`${basePath}/${meeting.id}`}
      className="group relative block overflow-hidden rounded-[var(--radius-md)] border border-neutral-200 bg-white shadow-sm transition-all hover:-translate-y-px hover:shadow-md"
      style={{ borderLeft: `4px solid ${borderColor}` }}
    >
      {/* Badge — top right */}
      <div className="absolute top-3.5 right-4">
        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-small font-medium ${badge.classes}`}>
          {badge.label}
        </span>
      </div>

      <div className="p-[var(--spacing-card)]">
        {/* Date + Time */}
        <div className="mb-2.5 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-2.5 py-1 text-xs font-bold text-primary-700">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            {formatKoreanDate(meeting.date)}
          </span>
          <span className="text-caption font-medium text-neutral-600">
            {formatKoreanTime(meeting.time)}
          </span>
        </div>

        {/* Title */}
        <h3 className="pr-16 text-[15px] font-semibold leading-snug text-neutral-900 transition-colors group-hover:text-primary-600">
          {meeting.title}
        </h3>

        {/* Details row */}
        <div className="mt-4 flex items-center gap-3 text-caption text-neutral-500">
          {/* Location */}
          <span className="flex items-center gap-1">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {meeting.location}
          </span>

          <span className="h-3 w-px bg-neutral-200" />

          {/* Participant count */}
          <span className={`flex items-center gap-1 ${capacityClass}`}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span className="font-mono tabular-nums">{confirmedCount}/{meeting.capacity}</span>명
          </span>

          <span className="h-3 w-px bg-neutral-200" />

          {/* Fee */}
          <span className="font-mono font-semibold tabular-nums text-accent-600">
            {formatFee(meeting.fee)}원
          </span>
        </div>
      </div>
    </Link>
  )
}
