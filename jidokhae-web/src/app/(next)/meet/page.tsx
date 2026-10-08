import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth'
import { getKSTToday, getDaysUntil } from '@/lib/kst'
import { isDiscussionApplyOpen } from '@/lib/discussion-rules'
import { isDiscussionMeetingEnabled, canApplyToDiscussion } from '@/lib/discussion-gate'
import { shouldMaskConfirmedCount } from '@/lib/visibility'
import { getProfile } from '@/lib/profile'
import MeetView, { type MeetData } from '@/components/next/MeetView'
import type { Meeting } from '@/types/meeting'

export default async function NextMeetPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>
}) {
  // 잠금 안내에서 넘어온 경우에만 목록 위 한 줄을 둔다 — 도착한 사람이 왜 여기 왔는지 잊지 않게
  const fromLock = (await searchParams).from === 'lock'
  const user = await getUser()
  const profile = user ? await getProfile(user.id) : null
  const isPrivileged = profile?.role === 'admin' || profile?.role === 'editor'
  const kstToday = getKSTToday()
  const supabase = await createClient()

  const { data: meetings } = await supabase
    .from('meetings')
    .select('*, books(thumbnail, authors)')
    .eq('status', 'active')
    .gte('date', kstToday)
    .order('date', { ascending: true })
    .order('time', { ascending: true })
  const upcoming = (meetings ?? []) as (Meeting & {
    books: { thumbnail: string | null; authors: string | null } | null
  })[]
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
  const myWaitlistedIds = new Set(
    (myRegs ?? []).filter((r) => r.status === 'waitlisted').map((r) => r.meeting_id),
  )

  // 내 신청 스트립 — 가장 가까운 것 하나. 대기 중이면 "대기 중"으로 구분 표시
  const mineMeeting = upcoming.find((m) => myIds.has(m.id))
  const mine: MeetData['mine'] = mineMeeting
    ? {
        id: mineMeeting.id,
        title: mineMeeting.title,
        date: mineMeeting.date,
        daysLeft: getDaysUntil(mineMeeting.date, kstToday),
        waitlisted: myWaitlistedIds.has(mineMeeting.id),
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

  // 격리 플래그 OFF면 토론 카드를 목록에서 뺀다(새로 들어오는 것만 막는다).
  // 🔴 이미 신청한 사람의 모임은 위 「내 신청」 스트립에 그대로 남고, 상세·취소도 살아 있다
  const discussionEnabled = await isDiscussionMeetingEnabled()
  const d = discussionEnabled
    ? upcoming.find((m) => m.meeting_type === 'discussion')
    : undefined

  // 자격 미충족 — 카드는 자격자와 똑같이 보이고 맨 아래 한 줄만 붙는다(흐리기·자물쇠 금지).
  // 이미 신청한 본인에게는 잠금 문구를 띄우지 않는다
  const locked = d && user && !myIds.has(d.id) ? !(await canApplyToDiscussion(user.id)) : false

  const discussion: MeetData['discussion'] = d
    ? {
        id: d.id,
        title: d.title,
        date: d.date,
        time: d.time,
        venueName: d.location,
        open: isDiscussionApplyOpen(d.date, kstToday),
        thumbnail: d.books?.thumbnail ?? null,
        authors: d.books?.authors ?? null,
        locked,
      }
    : null

  return <MeetView data={{ mine, regular, discussion }} showLockContext={fromLock && locked} />
}
