import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth'
import { getKSTToday, getDaysUntil } from '@/lib/kst'
import { isDiscussionApplyOpen } from '@/lib/discussion-rules'
import { shouldMaskConfirmedCount } from '@/lib/visibility'
import { getProfile } from '@/lib/profile'
import MeetView, { type MeetData } from '@/components/next/MeetView'
import type { Meeting } from '@/types/meeting'

export default async function NextMeetPage() {
  const user = await getUser()
  const profile = user ? await getProfile(user.id) : null
  const isPrivileged = profile?.role === 'admin' || profile?.role === 'editor'
  const kstToday = getKSTToday()
  const supabase = await createClient()

  const { data: meetings } = await supabase
    .from('meetings')
    .select('*')
    .eq('status', 'active')
    .gte('date', kstToday)
    .order('date', { ascending: true })
    .order('time', { ascending: true })
  const upcoming = (meetings ?? []) as Meeting[]
  const meetingIds = upcoming.map((m) => m.id)

  const [{ data: counts }, { data: myRegs }] = await Promise.all([
    meetingIds.length > 0
      ? supabase.rpc('get_confirmed_counts', { meeting_ids: meetingIds })
      : Promise.resolve({ data: [] }),
    user && meetingIds.length > 0
      ? supabase
          .from('registrations')
          .select('meeting_id, status')
          .eq('user_id', user.id)
          .in('status', ['confirmed', 'pending_transfer', 'waitlisted'])
          .in('meeting_id', meetingIds)
      : Promise.resolve({ data: [] as { meeting_id: string; status: string }[] }),
  ])

  const countMap = new Map(
    ((counts ?? []) as { meeting_id: string; confirmed_count: number }[]).map((c) => [
      c.meeting_id,
      c.confirmed_count,
    ]),
  )
  const myIds = new Set((myRegs ?? []).map((r) => r.meeting_id))

  // 내 신청 스트립 — 가장 가까운 것 하나
  const mineMeeting = upcoming.find((m) => myIds.has(m.id))
  const mine: MeetData['mine'] = mineMeeting
    ? {
        id: mineMeeting.id,
        title: mineMeeting.title,
        date: mineMeeting.date,
        daysLeft: getDaysUntil(mineMeeting.date, kstToday),
      }
    : null

  // 정기모임 — 카운트 마스킹 규칙 재사용 (기존 visibility 정책)
  const regular: MeetData['regular'] = upcoming
    .filter((m) => m.meeting_type !== 'discussion')
    .map((m) => {
      const count = countMap.get(m.id) ?? 0
      const masked = shouldMaskConfirmedCount(count, m.capacity, isPrivileged)
      return {
        id: m.id,
        date: m.date,
        time: m.time,
        venueName: m.location,
        confirmedLabel: masked
          ? `${m.capacity}명 모집 중`
          : `${count}/${m.capacity}명`,
        fee: m.fee,
      }
    })

  const d = upcoming.find((m) => m.meeting_type === 'discussion')
  const discussion: MeetData['discussion'] = d
    ? {
        id: d.id,
        title: d.title,
        date: d.date,
        time: d.time,
        venueName: d.location,
        open: isDiscussionApplyOpen(d.date, kstToday),
      }
    : null

  return <MeetView data={{ mine, regular, discussion }} />
}
