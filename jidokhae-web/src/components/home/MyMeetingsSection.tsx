'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { formatDDay } from '@/lib/kst'
import MeetingCard from '@/components/meetings/MeetingCard'
import type { Meeting } from '@/types/meeting'

const VISIBLE_LIMIT = 4

type RegistrationKind = 'confirmed' | 'pending_transfer' | 'waitlisted'

type MyMeetingItem = {
  meeting: Meeting
  kind: RegistrationKind
}

type Props = {
  nickname: string
  items: MyMeetingItem[]
  countMap: Record<string, number>
  kstToday: string
  isPrivileged: boolean
}

function pickBadge(item: MyMeetingItem, kstToday: string): { label: string; classes: string } {
  // waitlisted: D-Day 대신 "대기 중" (정원 미차지)
  if (item.kind === 'waitlisted') {
    return { label: '대기 중', classes: 'bg-accent-50 text-accent-600 border-accent-200' }
  }
  // confirmed + pending_transfer: D-Day 뱃지로 통일
  // (운영자 입금 확인 지연 시 회원 입장에서 사실상 신청 완료 상태이므로 동등 취급)
  const dDay = formatDDay(item.meeting.date, item.meeting.time, kstToday)
  if (!dDay) {
    return { label: '신청완료', classes: 'bg-accent-50 text-accent-700 border-accent-200' }
  }
  // D-3 이하 강조 (오늘/내일 포함)
  const isUrgent = dDay.startsWith('오늘') || dDay === '내일' || /^D-[0-3]$/.test(dDay)
  return isUrgent
    ? { label: dDay, classes: 'bg-accent-500 text-white border-accent-500' }
    : { label: dDay, classes: 'bg-accent-50 text-accent-700 border-accent-200' }
}

/**
 * 홈 "내 모임" 그룹.
 * Refactoring UI · Linear/Notion 패턴 — 박스 외피 없이 그룹 헤더 + 카드 리스트.
 * "전체 일정"과 동등 위계로 연속 흐름.
 */
export default function MyMeetingsSection({ nickname, items, countMap, kstToday, isPrivileged }: Props) {
  const [expanded, setExpanded] = useState(false)

  const visibleItems = useMemo(
    () => (expanded ? items : items.slice(0, VISIBLE_LIMIT)),
    [items, expanded],
  )
  const hiddenCount = Math.max(0, items.length - VISIBLE_LIMIT)

  if (items.length === 0) return null

  const headerLabel = nickname ? `${nickname}님이 신청한 모임` : '내 모임'

  return (
    <section className="mt-5">
      {/* 그룹 헤더 — 작은 ✓ + 라벨 + 카운트 + 전체 보기 */}
      <div className="mb-2.5 flex items-center gap-1.5">
        <span
          className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-white"
          style={{ backgroundColor: 'var(--color-primary-500)' }}
          aria-hidden="true"
        >
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
        <h2
          className="text-[14px] font-extrabold tracking-tight text-primary-800"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {headerLabel}
        </h2>
        <span className="text-[11px] font-semibold text-primary-500">
          · {items.length}건
        </span>
        <Link
          href="/my"
          className="ml-auto flex items-center gap-0.5 text-[11px] font-medium text-primary-600 hover:text-primary-700 transition-colors"
        >
          전체 보기
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>
      </div>

      <div className="flex flex-col gap-2.5">
        {visibleItems.map((item) => (
          <MeetingCard
            key={item.meeting.id}
            meeting={item.meeting}
            confirmedCount={countMap[item.meeting.id] ?? 0}
            isRegistered={item.kind === 'confirmed' || item.kind === 'pending_transfer'}
            isWaitlisted={item.kind === 'waitlisted'}
            isPrivileged={isPrivileged}
            customBadge={pickBadge(item, kstToday)}
          />
        ))}
      </div>

      {hiddenCount > 0 && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-2.5 flex w-full items-center justify-center gap-1 rounded-md border border-primary-200 bg-white py-2 text-xs font-semibold text-primary-700 hover:bg-primary-50 transition-colors"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
          더보기 ({hiddenCount}건 더)
        </button>
      )}
    </section>
  )
}

export type { MyMeetingItem, RegistrationKind }
