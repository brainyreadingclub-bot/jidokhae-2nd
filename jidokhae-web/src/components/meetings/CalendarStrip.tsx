'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'

type Props = {
  meetingDates: Set<string>
  registeredDates: Set<string>
  selectedDate: string | null
  onDateSelect: (date: string | null) => void
  kstToday: string
}

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

function parseDate(dateStr: string): Date {
  return new Date(dateStr + 'T12:00:00+09:00')
}

function formatDateStr(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getWeekDatesArr(baseDate: Date): Date[] {
  const day = baseDate.getUTCDay()
  const dates: Date[] = []
  for (let i = -day; i < 7 - day; i++) {
    const d = new Date(baseDate.getTime() + i * 24 * 60 * 60 * 1000)
    dates.push(d)
  }
  return dates
}

function getMonthDatesArr(year: number, month: number): (Date | null)[][] {
  const firstDay = new Date(Date.UTC(year, month, 1, 12))
  const startDow = firstDay.getUTCDay()
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0, 12)).getUTCDate()

  const weeks: (Date | null)[][] = []
  let week: (Date | null)[] = []

  for (let i = 0; i < startDow; i++) week.push(null)

  for (let d = 1; d <= daysInMonth; d++) {
    week.push(new Date(Date.UTC(year, month, d, 12)))
    if (week.length === 7) {
      weeks.push(week)
      week = []
    }
  }

  if (week.length > 0) {
    while (week.length < 7) week.push(null)
    weeks.push(week)
  }

  return weeks
}

type DayCellProps = {
  date: Date | null
  kstToday: string
  selectedDate: string | null
  meetingDates: Set<string>
  registeredDates: Set<string>
  onDateClick: (dateStr: string) => void
}

function DayCell({ date, kstToday, selectedDate, meetingDates, registeredDates, onDateClick }: DayCellProps) {
  if (!date) return <div className="h-10" />

  const dateStr = formatDateStr(date)
  const isToday = dateStr === kstToday
  const isSelected = dateStr === selectedDate
  const hasMeeting = meetingDates.has(dateStr)
  const hasRegistration = registeredDates.has(dateStr)
  const isSunday = date.getUTCDay() === 0

  return (
    <button
      type="button"
      data-today={isToday ? 'true' : undefined}
      onClick={() => hasMeeting ? onDateClick(dateStr) : undefined}
      className={`relative flex flex-col items-center justify-center rounded-full transition-colors h-10 w-10 ${
        isSelected
          ? 'bg-primary-600 text-white'
          : isToday
            ? 'bg-primary-50 text-primary-700'
            : hasMeeting
              ? 'text-primary-800 hover:bg-primary-50'
              : 'text-neutral-300'
      } ${isSunday && !isSelected ? 'text-accent-400' : ''}`}
      disabled={!hasMeeting}
    >
      <span className={`text-[13px] font-medium ${isSelected ? 'font-bold' : ''}`}>
        {date.getUTCDate()}
      </span>
      {hasMeeting && !isSelected && (
        <span className={`absolute bottom-0.5 h-1 w-1 rounded-full ${
          hasRegistration ? 'bg-accent-500' : 'bg-primary-400'
        }`} />
      )}
    </button>
  )
}

export default function CalendarStrip({
  meetingDates,
  registeredDates,
  selectedDate,
  onDateSelect,
  kstToday,
}: Props) {
  const [isMonthView, setIsMonthView] = useState(false)
  const [viewDate, setViewDate] = useState(() => parseDate(kstToday))
  const weekScrollRef = useRef<HTMLDivElement>(null)

  const viewYear = viewDate.getUTCFullYear()
  const viewMonth = viewDate.getUTCMonth()

  useEffect(() => {
    if (!isMonthView && weekScrollRef.current) {
      // weekRows: i=-1(index 0), i=0(index 1), i=1(index 2), ...
      // index 1 = viewDate의 주 (중앙 행)
      const rows = weekScrollRef.current.querySelectorAll('[data-week-row]')
      if (rows[1]) {
        ;(rows[1] as HTMLElement).scrollIntoView({ inline: 'start', block: 'nearest' })
      }
    }
  }, [isMonthView, viewDate])

  const handlePrev = useCallback(() => {
    if (isMonthView) {
      setViewDate(new Date(Date.UTC(viewYear, viewMonth - 1, 1, 12)))
    } else {
      setViewDate(new Date(viewDate.getTime() - 7 * 24 * 60 * 60 * 1000))
    }
  }, [isMonthView, viewYear, viewMonth, viewDate])

  const handleNext = useCallback(() => {
    if (isMonthView) {
      setViewDate(new Date(Date.UTC(viewYear, viewMonth + 1, 1, 12)))
    } else {
      setViewDate(new Date(viewDate.getTime() + 7 * 24 * 60 * 60 * 1000))
    }
  }, [isMonthView, viewYear, viewMonth, viewDate])

  const handleToday = useCallback(() => {
    setViewDate(parseDate(kstToday))
    onDateSelect(null)
  }, [kstToday, onDateSelect])

  const handleDateClick = useCallback((dateStr: string) => {
    onDateSelect(selectedDate === dateStr ? null : dateStr)
  }, [selectedDate, onDateSelect])

  // Compute week dates for scrollable strip
  const weekRows = useMemo(() => {
    const rows: Date[][] = []
    for (let i = -1; i <= 3; i++) {
      const base = new Date(viewDate.getTime() + i * 7 * 24 * 60 * 60 * 1000)
      rows.push(getWeekDatesArr(base))
    }
    return rows
  }, [viewDate])

  // Compute month grid
  const monthWeeks = useMemo(
    () => getMonthDatesArr(viewYear, viewMonth),
    [viewYear, viewMonth],
  )

  const dayCellProps = {
    kstToday,
    selectedDate,
    meetingDates,
    registeredDates,
    onDateClick: handleDateClick,
  }

  const monthLabel = `${viewYear}년 ${viewMonth + 1}월`

  return (
    <div
      className="rounded-[var(--radius-lg)] overflow-hidden"
      style={{
        backgroundColor: 'var(--color-surface-100)',
        border: '1px solid var(--color-surface-300)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrev}
            className="flex h-7 w-7 items-center justify-center rounded-full text-primary-400 hover:bg-primary-50 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span className="text-sm font-bold text-primary-800 min-w-[90px] text-center">{monthLabel}</span>
          <button
            type="button"
            onClick={handleNext}
            className="flex h-7 w-7 items-center justify-center rounded-full text-primary-400 hover:bg-primary-50 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleToday}
            className="rounded-full px-2.5 py-1 text-[11px] font-bold text-primary-500 hover:bg-primary-50 transition-colors"
          >
            오늘
          </button>
          <button
            type="button"
            onClick={() => setIsMonthView(!isMonthView)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-primary-400 hover:bg-primary-50 transition-colors"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-transform ${isMonthView ? 'rotate-180' : ''}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 px-3 pb-1">
        {DAY_LABELS.map((label, i) => (
          <div key={label} className={`text-center text-[11px] font-medium ${i === 0 ? 'text-accent-400' : 'text-neutral-400'}`}>
            {label}
          </div>
        ))}
      </div>

      {/* Calendar body */}
      <div className="px-3 pb-3">
        {isMonthView ? (
          <div className="space-y-1">
            {monthWeeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-0">
                {week.map((d, di) => (
                  <div key={di} className="flex justify-center">
                    <DayCell date={d} {...dayCellProps} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div ref={weekScrollRef} className="overflow-x-auto scrollbar-hide -mx-1 snap-x snap-mandatory">
            <div className="inline-flex gap-0">
              {weekRows.map((week, wi) => (
                <div key={wi} data-week-row className="grid grid-cols-7 gap-0 px-1 snap-start" style={{ minWidth: '100%' }}>
                  {week.map((d, di) => (
                    <div key={di} className="flex justify-center">
                      <DayCell date={d} {...dayCellProps} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
