import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth'
import { getKSTToday, getDaysUntil } from '@/lib/kst'
import { isDiscussionMeetingEnabled, canApplyToDiscussion } from '@/lib/discussion-gate'
import { getSeatStatus, resolveSeatThresholds } from '@/lib/seat-status'
import { getSiteSettings } from '@/lib/site-settings'
import { getProfile } from '@/lib/profile'
import { resolveHomeUpcomingClick } from '@/lib/home-upcoming'
import { recordAppEvent } from '@/lib/app-events'
import MeetView, { type MeetData } from '@/components/next/MeetView'
import TrackMeetList from '@/components/analytics/TrackMeetList'
import type { Meeting } from '@/types/meeting'

export default async function NextMeetPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>
}) {
  // 잠금 안내에서 넘어온 경우에만 목록 위 한 줄을 둔다 — 도착한 사람이 왜 여기 왔는지 잊지 않게
  const { from } = await searchParams
  const fromLock = from === 'lock'
  const user = await getUser()
  // 홈 「다른 일정도 보기」에서 왔으면 기록표에 한 줄 남긴다 (2026-10-13 결정). 실패해도 목록은 그대로
  const click = resolveHomeUpcomingClick({ page: 'list', userId: user?.id, from })
  if (click) after(recordAppEvent({ ...click, userId: user?.id }))
  const profile = user ? await getProfile(user.id) : null
  const isPrivileged = profile?.role === 'admin' || profile?.role === 'editor'
  const kstToday = getKSTToday()
  // 자리 문구 기준 비율 — 실서비스에선 레이아웃의 next_ui 조회와 같은 요청이라 cache()가 그대로 돌려준다
  const seatThresholds = resolveSeatThresholds(await getSiteSettings())
  const supabase = await createClient()

  const { data: meetings, error: meetingsError } = await supabase
    .from('meetings')
    .select('*, books(thumbnail, authors)')
    .eq('status', 'active')
    .gte('date', kstToday)
    .order('date', { ascending: true })
    .order('time', { ascending: true })
  // 조회 실패를 빈 목록으로 삼키면 「등록된 모임이 없어요」가 뜬다 — 진짜 0건과 구분이 안 된다.
  // 던져서 (next)/error.tsx의 「다시 시도」로 보낸다 (2026-10-13 화면 점검)
  if (meetingsError) throw new Error(`모임 목록 조회 실패: ${meetingsError.message}`)
  const upcoming = (meetings ?? []) as (Meeting & {
    books: { thumbnail: string | null; authors: string | null } | null
  })[]
  const meetingIds = upcoming.map((m) => m.id)

  const [countsResult, myRegsResult] = await Promise.all([
    meetingIds.length > 0
      ? supabase.rpc('get_confirmed_counts', { meeting_ids: meetingIds })
      : Promise.resolve({ data: [], error: null }),
    user && meetingIds.length > 0
      ? supabase
          .from('registrations')
          .select('meeting_id, status')
          .eq('user_id', user.id)
          .in('status', ['confirmed', 'pending_transfer', 'waitlisted'])
          .in('meeting_id', meetingIds)
      : Promise.resolve({ data: [] as { meeting_id: string; status: string }[], error: null }),
  ])
  // 인원·내 신청이 틀리면 「신청하기」가 이미 신청한 사람에게도 뜬다 — 이것도 빈 값으로 삼키지 않는다
  if (countsResult.error) throw new Error(`참가자 수 조회 실패: ${countsResult.error.message}`)
  if (myRegsResult.error) throw new Error(`내 신청 조회 실패: ${myRegsResult.error.message}`)
  const counts = countsResult.data
  const myRegs = myRegsResult.data

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

  const myPendingIds = new Set(
    (myRegs ?? []).filter((r) => r.status === 'pending_transfer').map((r) => r.meeting_id),
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
        pendingTransfer: myPendingIds.has(mineMeeting.id),
      }
    : null

  // 정기모임 — 카운트 마스킹 규칙 재사용 (기존 visibility 정책)
  const regular: MeetData['regular'] = upcoming
    .filter((m) => m.meeting_type !== 'discussion')
    .map((m) => {
      // 자리 상태 공통 규칙(seat-status.ts) — 위 마스킹 규칙도 그 안에서 지킨다
      const seat = getSeatStatus({
        capacity: m.capacity,
        confirmed: countMap.get(m.id) ?? 0,
        isPrivileged,
        thresholds: seatThresholds,
      })
      return {
        id: m.id,
        date: m.date,
        time: m.time,
        venueName: m.location,
        confirmedLabel: seat.label,
        seatEmphasis: seat.tone === 'emphasis',
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
        thumbnail: d.books?.thumbnail ?? null,
        authors: d.books?.authors ?? null,
        locked,
      }
    : null

  // 목록을 봤다 — 기록표는 응답 뒤 after()로, GA view_item_list는 브라우저에서 마운트 1회 (TrackMeetList).
  // 정기 행 + 토론 카드 = 화면에 실제로 놓인 모임 수
  const itemsCount = regular.length + (discussion ? 1 : 0)
  after(recordAppEvent({ event: 'meet.view_item_list', userId: user?.id, props: { items_count: itemsCount } }))

  return (
    <>
      <TrackMeetList itemsCount={itemsCount} />
      <MeetView data={{ mine, regular, discussion }} showLockContext={fromLock && locked} />
    </>
  )
}
