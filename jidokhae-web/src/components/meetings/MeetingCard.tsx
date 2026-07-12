'use client'

import Link from 'next/link'
import { formatKoreanDate, formatKoreanTime, formatFee } from '@/lib/kst'
import { shouldMaskConfirmedCount } from '@/lib/visibility'
import type { Meeting } from '@/types/meeting'

type MeetingCardProps = {
  meeting: Meeting
  confirmedCount: number
  isRegistered: boolean
  isWaitlisted?: boolean
  isPrivileged?: boolean
  basePath?: string
  /** 우상단 뱃지를 강제 교체 (예: 홈 "내가 신청한 모임" 섹션의 D-Day 뱃지) */
  customBadge?: { label: string; classes: string } | null
}

export default function MeetingCard({
  meeting,
  confirmedCount,
  isRegistered,
  isWaitlisted,
  isPrivileged = false,
  basePath = '/meetings',
  customBadge = null,
}: MeetingCardProps) {
  const isFull = confirmedCount >= meeting.capacity
  const isMasked = shouldMaskConfirmedCount(confirmedCount, meeting.capacity, isPrivileged)
  const isAlmostFull = !isFull && !isMasked && confirmedCount >= meeting.capacity * 0.8

  // 본인 신청/대기가 아닌 공개 카드에서만 신청 CTA row 노출 (스펙 §4-2-1: 카드는 모집중/마감 2분기)
  const showCta = !isRegistered && !isWaitlisted

  // 상태 뱃지 (우선순위: customBadge > 신청완료 > 대기 중 > 마감 > 모집중)
  const badge = customBadge ?? (
    isRegistered
      ? { label: '신청완료', classes: 'bg-primary-100 text-primary-600' }
      : isWaitlisted
        ? { label: '대기 중', classes: 'bg-neutral-100 text-neutral-700' }
        : isFull
          ? { label: '마감', classes: 'bg-neutral-100 text-neutral-600' }
          : { label: '모집중', classes: 'bg-primary-100 text-primary-600' }
  )

  // 인원 카운트 색 (마감=뮤트, 임박=코럴 포인트, 그외=뉴트럴)
  const capacityClass = isFull
    ? 'text-neutral-400'
    : isAlmostFull
      ? 'text-accent-500 font-semibold'
      : 'text-neutral-700'

  const detailHref = `${basePath}/${meeting.id}`

  return (
    <article className="group relative overflow-hidden rounded-[var(--radius-lg)] border border-neutral-200 bg-white shadow-sm transition-all hover:-translate-y-px hover:shadow-md">
      {/* 상태 뱃지 — 우상단 */}
      <div className="absolute top-3.5 right-4 z-10">
        <span className={`inline-flex items-center rounded-[var(--radius-sm)] px-2 py-0.5 text-small font-extrabold ${badge.classes}`}>
          {badge.label}
        </span>
      </div>

      <Link href={detailHref} className={`block px-4 pt-4 ${showCta ? 'pb-3.5' : 'pb-4'}`}>
        {/* 날짜 + 시간 (무배경 뉴트럴 — 그린 pill 금지) */}
        <div className="flex items-center">
          <span className="inline-flex items-center gap-1.5 text-caption font-semibold text-neutral-700">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-50">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            {formatKoreanDate(meeting.date)}
          </span>
          <span className="ml-2 text-caption font-medium text-neutral-600">
            {formatKoreanTime(meeting.time)}
          </span>
        </div>

        {/* 제목 (세리프) */}
        <h3
          className="mt-2 pr-14 text-[17px] font-bold leading-snug tracking-tight text-neutral-900 transition-colors group-hover:text-primary-600"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {meeting.title}
        </h3>

        {/* 상세 메타 — 장소 · 인원 (참가비는 하단 CTA row로 이동) */}
        <div className="mt-3.5 flex items-center gap-2.5 text-[12px] text-neutral-600">
          <span className="flex items-center gap-1">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {meeting.location}
          </span>

          <span className="h-2.5 w-px bg-neutral-200" />

          <span className={`flex items-center gap-1 ${capacityClass}`}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            {isMasked
              ? <span>{meeting.capacity}명 모집 중</span>
              : <><span className="tabular-nums">{confirmedCount}/{meeting.capacity}</span>명</>
            }
          </span>
        </div>
      </Link>

      {/* 상태 인지형 신청 숏컷 CTA row — 공개 카드 전용 */}
      {showCta && (
        <div className="mx-4 flex items-center justify-between border-t border-neutral-100 pt-3 pb-4">
          <span className="text-[13px] font-semibold tabular-nums text-neutral-700">
            {formatFee(meeting.fee)}
          </span>
          {isFull ? (
            <span className="rounded-[9px] bg-neutral-100 px-4 py-1.5 text-xs font-bold text-neutral-600">
              마감
            </span>
          ) : (
            <Link
              href={detailHref}
              className="rounded-[9px] bg-primary-500 px-4 py-1.5 text-xs font-bold text-white transition-colors hover:bg-primary-600"
            >
              신청하기
            </Link>
          )}
        </div>
      )}
    </article>
  )
}
