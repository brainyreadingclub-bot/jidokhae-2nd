'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { formatDDay } from '@/lib/kst'
import type { Meeting } from '@/types/meeting'

const VISIBLE_LIMIT = 4
const DOW = ['일', '월', '화', '수', '목', '금', '토']

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
}

function shortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00+09:00')
  const [, mm, dd] = dateStr.split('-')
  return `${Number(mm)}/${Number(dd)}(${DOW[d.getUTCDay()]})`
}

/**
 * "내 모임" 상태별 strip — 스펙 §4-5·§5.
 * - confirmed / pending_transfer: 초록 strip (모임 정체성). 이 뷰에선 D-day 코럴 톤다운(연그린).
 * - waitlisted: 뉴트럴 회색 strip (확정 아님 + 긴박 아님 → 무채색 "보류").
 * 코럴은 pending 입금 안내 점 1개에만.
 */
function MyMeetingStrip({ item, countMap, kstToday }: { item: MyMeetingItem; countMap: Record<string, number>; kstToday: string }) {
  const { meeting, kind } = item
  const href = `/meetings/${meeting.id}`
  const date = shortDate(meeting.date)

  // waitlisted — 뉴트럴 회색 (그린·코럴 어느 쪽도 아님)
  if (kind === 'waitlisted') {
    return (
      <Link
        href={href}
        className="flex items-center gap-2.5 rounded-[var(--radius-md)] px-3.5 py-2.5 transition-colors hover:bg-neutral-100"
        style={{ backgroundColor: 'var(--color-neutral-100)', border: '1px solid var(--color-neutral-200)' }}
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-bold tracking-tight text-neutral-700" style={{ fontFamily: 'var(--font-display)' }}>
            대기 중 · {meeting.title}
          </div>
          <div className="mt-0.5 text-[12px] text-neutral-500">{date} · 자리가 나면 알려드려요</div>
        </div>
        <span
          className="ml-auto flex-shrink-0 rounded-full bg-white px-2.5 py-0.5 text-[11px] font-bold text-neutral-500"
          style={{ border: '1px solid var(--color-neutral-300)' }}
        >
          대기 중
        </span>
      </Link>
    )
  }

  // confirmed | pending_transfer — 초록 strip (동등 안심)
  const isPending = kind === 'pending_transfer'
  const dDay = formatDDay(meeting.date, meeting.time, kstToday)
  const count = countMap[meeting.id] ?? 0

  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 rounded-[var(--radius-md)] px-3.5 py-2.5 transition-colors hover:brightness-[0.98]"
      style={{ backgroundColor: 'var(--color-primary-50)', border: '1px solid var(--color-primary-200)' }}
    >
      <span
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-white"
        style={{ backgroundColor: 'var(--color-primary-500)' }}
        aria-hidden="true"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-bold tracking-tight text-primary-800" style={{ fontFamily: 'var(--font-display)' }}>
          {isPending ? '신청 접수됨' : '신청 완료'} · {meeting.title}
        </div>
        <div className="mt-0.5 flex items-center gap-1 text-[12px] text-primary-600">
          {isPending ? (
            <>
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent-500" aria-hidden="true" />
              {date} · 입금 확인 대기 중
            </>
          ) : (
            <>{date} · {count}명과 함께 읽어요</>
          )}
        </div>
      </div>
      {dDay && (
        <span className="ml-auto flex-shrink-0 rounded-full bg-primary-100 px-2 py-0.5 text-[11px] font-bold text-primary-700">
          {dDay}
        </span>
      )}
    </Link>
  )
}

/**
 * 홈 "내 모임" 그룹.
 * Refactoring UI · Linear/Notion 패턴 — 박스 외피 없이 그룹 헤더 + strip 리스트.
 * "전체 일정"과 동등 위계로 연속 흐름.
 */
export default function MyMeetingsSection({ nickname, items, countMap, kstToday }: Props) {
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

      <div className="flex flex-col gap-2">
        {visibleItems.map((item) => (
          <MyMeetingStrip key={item.meeting.id} item={item} countMap={countMap} kstToday={kstToday} />
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
