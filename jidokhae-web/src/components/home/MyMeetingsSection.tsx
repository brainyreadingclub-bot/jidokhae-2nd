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
  // waitlisted: D-Day 대신 "대기 중"
  if (item.kind === 'waitlisted') {
    return { label: '대기 중', classes: 'bg-accent-50 text-accent-600 border-accent-200' }
  }
  // pending_transfer: 보조 라벨 — 정식 참여자 아니라 D-Day 대신 "입금대기"
  if (item.kind === 'pending_transfer') {
    return { label: '입금대기', classes: 'bg-accent-50 text-accent-600 border-accent-200' }
  }
  // confirmed: D-Day 뱃지 (D-3 이하 강조)
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
    <section
      className="mt-5 rounded-[var(--radius-lg)] p-4"
      style={{
        background: 'linear-gradient(180deg, var(--color-accent-50), var(--color-surface-50))',
        border: '1px solid var(--color-accent-200)',
      }}
    >
      <div className="mb-3 flex items-center gap-2">
        <span
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-white"
          style={{ background: 'var(--color-accent-500)' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
        <h2 className="flex-1 text-sm font-extrabold tracking-tight text-accent-700">
          {headerLabel} <span className="ml-1 text-xs font-semibold text-accent-600">· {items.length}건</span>
        </h2>
        <Link
          href="/my"
          className="flex items-center gap-0.5 text-xs font-medium text-accent-600 hover:text-accent-700 transition-colors"
        >
          전체 보기
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
          className="mt-3 flex w-full items-center justify-center gap-1 rounded-md border border-accent-200 bg-white py-2 text-xs font-semibold text-accent-700 hover:bg-accent-50 transition-colors"
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
