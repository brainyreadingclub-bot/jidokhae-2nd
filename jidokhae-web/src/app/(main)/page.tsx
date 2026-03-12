import { createClient } from '@/lib/supabase/server'
import { getKSTToday } from '@/lib/kst'
import MeetingCard from '@/components/meetings/MeetingCard'
import EmptyMeetings from '@/components/meetings/EmptyMeetings'
import type { Meeting } from '@/types/meeting'

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const kstToday = getKSTToday()

  // Fetch active meetings from today onwards
  const { data: meetings } = await supabase
    .from('meetings')
    .select('*')
    .eq('status', 'active')
    .gte('date', kstToday)
    .order('date', { ascending: true })
    .order('time', { ascending: true })

  const typedMeetings = (meetings ?? []) as Meeting[]

  if (typedMeetings.length === 0) {
    return (
      <div className="px-4 pt-6">
        <h1 className="text-xl font-bold text-gray-900">모임 일정</h1>
        <EmptyMeetings />
      </div>
    )
  }

  const meetingIds = typedMeetings.map((m) => m.id)

  // Parallel: confirmed counts + user's registrations
  const [countsResult, myRegsResult] = await Promise.all([
    supabase.rpc('get_confirmed_counts', { meeting_ids: meetingIds }),
    user
      ? supabase
          .from('registrations')
          .select('meeting_id')
          .eq('user_id', user.id)
          .eq('status', 'confirmed')
          .in('meeting_id', meetingIds)
      : Promise.resolve({ data: [] }),
  ])

  const countMap = new Map<string, number>(
    (countsResult.data ?? []).map(
      (c: { meeting_id: string; confirmed_count: number }) => [
        c.meeting_id,
        Number(c.confirmed_count),
      ] as [string, number],
    ),
  )
  const registeredSet = new Set(
    (myRegsResult.data ?? []).map(
      (r: { meeting_id: string }) => r.meeting_id,
    ),
  )

  return (
    <div className="px-4 pt-6">
      <h1 className="text-xl font-bold text-gray-900">모임 일정</h1>
      <div className="mt-4 flex flex-col gap-3">
        {typedMeetings.map((meeting) => (
          <MeetingCard
            key={meeting.id}
            meeting={meeting}
            confirmedCount={countMap.get(meeting.id) ?? 0}
            isRegistered={registeredSet.has(meeting.id)}
          />
        ))}
      </div>
    </div>
  )
}
