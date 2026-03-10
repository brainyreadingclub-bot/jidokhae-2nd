import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getKSTToday } from '@/lib/kst'
import AdminMeetingCard from '@/components/admin/AdminMeetingCard'
import type { Meeting } from '@/types/meeting'

export default async function AdminPage() {
  const kstToday = getKSTToday()
  const supabase = await createClient()

  const { data: meetings } = await supabase
    .from('meetings')
    .select('*')
    .in('status', ['active', 'deleting'])
    .order('date', { ascending: false })
    .order('time', { ascending: false })

  const typedMeetings = (meetings ?? []) as Meeting[]

  const meetingIds = typedMeetings.map((m) => m.id)

  const { data: counts } = meetingIds.length > 0
    ? await supabase.rpc('get_confirmed_counts', { meeting_ids: meetingIds })
    : { data: [] }

  const countMap = new Map<string, number>(
    (counts ?? []).map(
      (c: { meeting_id: string; confirmed_count: number }) => [
        c.meeting_id,
        Number(c.confirmed_count),
      ] as [string, number],
    ),
  )

  return (
    <div className="px-4 pt-4 pb-6">
      {/* Header with create button */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold text-gray-900">모임 목록</h1>
        <Link
          href="/admin/meetings/new"
          className="inline-flex items-center gap-1 rounded-[var(--radius-md)] bg-primary-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-600"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          새 모임
        </Link>
      </div>

      {typedMeetings.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm text-gray-400">등록된 모임이 없습니다</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
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
    </div>
  )
}
