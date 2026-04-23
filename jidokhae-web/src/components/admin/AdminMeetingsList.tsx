import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getKSTToday, getKSTMonth, getPrevMonth, getMonthRange } from '@/lib/kst'
import AdminMeetingCard from '@/components/admin/AdminMeetingCard'
import RegionFilter from '@/components/admin/RegionFilter'
import type { Meeting } from '@/types/meeting'

const FILTER_OPTIONS = [
  { key: 'active', label: '진행 중' },
  { key: 'last-month', label: '지난 달' },
  { key: 'all', label: '전체' },
] as const

function buildHref(current: { filter: string; region: string }, patch: Partial<{ filter: string; region: string }>) {
  const next = { ...current, ...patch }
  const params = new URLSearchParams()
  if (next.filter !== 'active') params.set('filter', next.filter)
  if (next.region !== 'all') params.set('region', next.region)
  const qs = params.toString()
  return qs ? `/admin/meetings?${qs}` : '/admin/meetings'
}

export default async function AdminMeetingsList({
  filter,
  region,
}: {
  filter: string
  region: string
}) {
  const supabase = await createClient()
  const kstToday = getKSTToday()
  const currentMonth = getKSTMonth()
  const prevMonth = getPrevMonth(currentMonth)

  let query = supabase.from('meetings').select('*')
  if (filter === 'last-month') {
    // Phase 3 M7 Step 2.5: last-month 필터에도 deleted 제외
    // 다른 필터(active/all)와 정책 일관성 확보
    const prev = getMonthRange(prevMonth)
    query = query.gte('date', prev.start).lt('date', prev.end).neq('status', 'deleted')
  } else if (filter === 'all') {
    query = query.neq('status', 'deleted')
  } else {
    query = query.in('status', ['active', 'deleting'])
  }

  if (region !== 'all') {
    query = query.eq('region', region)
  }

  query = query.order('date', { ascending: false }).order('time', { ascending: false })

  const { data: meetings, error } = await query

  if (error) {
    throw new Error(`모임 목록 조회 실패: ${error.message}`)
  }

  const typedMeetings = (meetings ?? []) as Meeting[]
  const meetingIds = typedMeetings.map((m) => m.id)

  const { data: counts } = meetingIds.length > 0
    ? await supabase.rpc('get_confirmed_counts', { meeting_ids: meetingIds })
    : { data: [] }

  const countMap = new Map<string, number>(
    ((counts ?? []) as { meeting_id: string; confirmed_count: number }[])
      .map((c) => [c.meeting_id, Number(c.confirmed_count)] as [string, number]),
  )

  return (
    <>
      {/* Filter toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {FILTER_OPTIONS.map((f) => (
            <Link
              key={f.key}
              href={buildHref({ filter, region }, { filter: f.key })}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
                filter === f.key
                  ? 'bg-primary-600 text-white'
                  : 'text-primary-600 hover:bg-primary-50'
              }`}
              style={filter !== f.key ? { border: '1px solid var(--color-surface-300)', backgroundColor: 'var(--color-surface-50)' } : undefined}
            >
              {f.label}
            </Link>
          ))}
        </div>

        <RegionFilter currentRegion={region} basePath="/admin/meetings" />
      </div>

      {/* Result count */}
      <div className="mb-3 text-xs font-medium text-primary-500">
        총 {typedMeetings.length}건
      </div>

      {typedMeetings.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm text-primary-400">
            {filter === 'active' ? '등록된 모임이 없습니다' : '해당 조건에 맞는 모임이 없습니다'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {typedMeetings.map((meeting) => (
            <AdminMeetingCard
              key={meeting.id}
              meeting={meeting}
              confirmedCount={countMap.get(meeting.id) ?? 0}
              kstToday={kstToday}
            />
          ))}
        </div>
      )}
    </>
  )
}
