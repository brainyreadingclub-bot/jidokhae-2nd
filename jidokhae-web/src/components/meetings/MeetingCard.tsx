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
      className="group relative block overflow-hidden rounded-[var(--radius-lg)] border-l-[3px] border-primary-400 bg-white transition-all duration-200 hover:-translate-y-0.5"
      style={{
        boxShadow: 'var(--shadow-card)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = 'var(--shadow-card-hover)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'var(--shadow-card)'
      }}
    >
      {/* Badge — top right */}
      {(isRegistered || isFull) && (
        <div className="absolute top-3 right-3">
          {isRegistered ? (
            <span className="inline-flex items-center rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-semibold text-success">
              신청완료
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-error/10 px-2.5 py-0.5 text-xs font-semibold text-error">
              마감
            </span>
          )}
        </div>
      )}

      <div className="px-4 py-4">
        {/* Date chip */}
        <div className="mb-2 flex items-center gap-2">
          <span className="inline-flex items-center rounded-[var(--radius-sm)] bg-primary-50 px-2 py-0.5 text-xs font-semibold text-primary-700">
            {formatKoreanDate(meeting.date)}
          </span>
          <span className="text-xs text-gray-400">
            {formatKoreanTime(meeting.time)}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-base font-bold text-gray-900 leading-snug pr-16 group-hover:text-primary-700 transition-colors duration-200">
          {meeting.title}
        </h3>

        {/* Details row */}
        <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
          {/* Location */}
          <span className="flex items-center gap-1">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-gray-400"
            >
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {meeting.location}
          </span>

          {/* Divider */}
          <span className="h-3 w-px bg-gray-200" />

          {/* Participant count */}
          <span className="flex items-center gap-1">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-gray-400"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            {confirmedCount}명 참여
          </span>

          {/* Divider */}
          <span className="h-3 w-px bg-gray-200" />

          {/* Fee */}
          <span className="font-medium text-primary-600">
            {formatFee(meeting.fee)}
          </span>
        </div>
      </div>
    </Link>
  )
}
