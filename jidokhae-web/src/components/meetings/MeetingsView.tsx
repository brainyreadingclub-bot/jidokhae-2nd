'use client'

import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { trackEvent } from '@/lib/analytics'
import CalendarStrip from './CalendarStrip'
import DateSectionHeader from './DateSectionHeader'
import MeetingCard from './MeetingCard'
import MyMeetingsSection, { type MyMeetingItem } from '@/components/home/MyMeetingsSection'
import type { Meeting } from '@/types/meeting'

type Props = {
  meetings: Meeting[]
  countMap: Record<string, number>
  registeredSet: string[]
  waitlistedSet: string[]
  pendingTransferSet?: string[]
  nickname?: string
  kstToday: string
  isPrivileged: boolean
}

export default function MeetingsView({
  meetings,
  countMap,
  registeredSet,
  waitlistedSet,
  pendingTransferSet = [],
  nickname = '',
  kstToday,
  isPrivileged,
}: Props) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const dateRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const registeredSetObj = useMemo(() => new Set(registeredSet), [registeredSet])
  const waitlistedSetObj = useMemo(() => new Set(waitlistedSet), [waitlistedSet])
  const pendingSetObj = useMemo(() => new Set(pendingTransferSet), [pendingTransferSet])

  // Unique meeting dates
  const meetingDates = useMemo(
    () => new Set(meetings.map((m) => m.date)),
    [meetings],
  )

  // Dates with user registrations (for green dots)
  const registeredDates = useMemo(() => {
    const dates = new Set<string>()
    for (const m of meetings) {
      if (registeredSetObj.has(m.id) || waitlistedSetObj.has(m.id) || pendingSetObj.has(m.id)) {
        dates.add(m.date)
      }
    }
    return dates
  }, [meetings, registeredSetObj, waitlistedSetObj, pendingSetObj])

  // 내가 신청한 모임 (confirmed > pending_transfer > waitlisted, 임박순 정렬)
  const myMeetingItems = useMemo<MyMeetingItem[]>(() => {
    const items: MyMeetingItem[] = []
    for (const m of meetings) {
      if (registeredSetObj.has(m.id)) {
        items.push({ meeting: m, kind: 'confirmed' })
      } else if (pendingSetObj.has(m.id)) {
        items.push({ meeting: m, kind: 'pending_transfer' })
      } else if (waitlistedSetObj.has(m.id)) {
        items.push({ meeting: m, kind: 'waitlisted' })
      }
    }
    // meetings는 이미 (date asc, time asc)로 정렬되어 있어 임박순과 일치
    return items
  }, [meetings, registeredSetObj, pendingSetObj, waitlistedSetObj])

  const myMeetingIdsSet = useMemo(
    () => new Set(myMeetingItems.map((it) => it.meeting.id)),
    [myMeetingItems],
  )

  // Group meetings by date — 필터 미적용 시 본인 신청 모임은 상단 섹션으로 이동시키고 그룹에서 제외
  const groupedMeetings = useMemo(() => {
    const groups: { date: string; meetings: Meeting[] }[] = []
    let currentDate = ''
    let currentGroup: Meeting[] = []

    const filtered = selectedDate
      ? meetings // 캘린더 필터 적용 시: 모든 모임 그대로 (섹션 숨겨짐)
      : meetings.filter((m) => !myMeetingIdsSet.has(m.id))

    for (const m of filtered) {
      if (m.date !== currentDate) {
        if (currentGroup.length > 0) {
          groups.push({ date: currentDate, meetings: currentGroup })
        }
        currentDate = m.date
        currentGroup = [m]
      } else {
        currentGroup.push(m)
      }
    }
    if (currentGroup.length > 0) {
      groups.push({ date: currentDate, meetings: currentGroup })
    }

    return groups
  }, [meetings, myMeetingIdsSet, selectedDate])

  // Filter groups by selected date
  const visibleGroups = useMemo(
    () =>
      selectedDate
        ? groupedMeetings.filter((g) => g.date === selectedDate)
        : groupedMeetings,
    [groupedMeetings, selectedDate],
  )

  // Summary stats
  const thisMonthCount = useMemo(() => {
    const month = kstToday.slice(0, 7)
    return meetings.filter((m) => m.date.startsWith(month)).length
  }, [meetings, kstToday])

  const myRegistrationCount = myMeetingItems.length

  useEffect(() => {
    trackEvent('view_item_list', {
      item_list_name: 'meetings',
      items_count: meetings.length,
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleDateSelect = useCallback((date: string | null) => {
    setSelectedDate(date)
    if (date) {
      // Scroll to the date section
      requestAnimationFrame(() => {
        const el = dateRefs.current.get(date)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      })
    }
  }, [])

  const setDateRef = useCallback((date: string) => (el: HTMLDivElement | null) => {
    if (el) {
      dateRefs.current.set(date, el)
    } else {
      dateRefs.current.delete(date)
    }
  }, [])

  return (
    <div>
      {/* Header summary */}
      <div className="flex items-center gap-2 text-[13px] text-primary-500 mb-3">
        <span>이번 달 {thisMonthCount}회 모임</span>
        {myRegistrationCount > 0 && (
          <>
            <span className="text-neutral-300">·</span>
            <span>내 신청 {myRegistrationCount}건</span>
          </>
        )}
      </div>

      {/* Calendar */}
      <CalendarStrip
        meetingDates={meetingDates}
        registeredDates={registeredDates}
        selectedDate={selectedDate}
        onDateSelect={handleDateSelect}
        kstToday={kstToday}
      />

      {/* My meetings — 캘린더 필터 미적용일 때만 상단 섹션 */}
      {!selectedDate && myMeetingItems.length > 0 && (
        <MyMeetingsSection
          nickname={nickname}
          items={myMeetingItems}
          countMap={countMap}
          kstToday={kstToday}
          isPrivileged={isPrivileged}
        />
      )}

      {/* Reset filter button */}
      {selectedDate && (
        <button
          type="button"
          onClick={() => handleDateSelect(null)}
          className="mt-4 flex items-center gap-1.5 text-[13px] font-medium text-primary-500 hover:text-primary-700 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          전체 일정 보기
        </button>
      )}

      {/* "전체 일정" 디바이더 — 신청 섹션이 있을 때만 */}
      {!selectedDate && myMeetingItems.length > 0 && groupedMeetings.length > 0 && (
        <div className="mt-5 mb-2 text-xs font-bold uppercase tracking-wider text-neutral-500">
          전체 일정
        </div>
      )}

      {/* Date-grouped meeting list */}
      <div className={`${selectedDate ? 'mt-3' : myMeetingItems.length > 0 ? 'mt-1' : 'mt-5'} flex flex-col gap-5`}>
        {visibleGroups.length === 0 && selectedDate && (
          <div className="py-8 text-center text-sm text-neutral-400">
            선택한 날짜에 모임이 없습니다
          </div>
        )}
        {visibleGroups.map((group) => (
          <div key={group.date} ref={setDateRef(group.date)}>
            <DateSectionHeader date={group.date} kstToday={kstToday} />
            <div className="flex flex-col gap-3">
              {group.meetings.map((meeting) => (
                <MeetingCard
                  key={meeting.id}
                  meeting={meeting}
                  confirmedCount={countMap[meeting.id] ?? 0}
                  isRegistered={registeredSetObj.has(meeting.id)}
                  isWaitlisted={waitlistedSetObj.has(meeting.id)}
                  isPrivileged={isPrivileged}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
