import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/profile'
import { getKSTToday } from '@/lib/kst'
import { getSiteSettings } from '@/lib/site-settings'
import MeetingCard from '@/components/meetings/MeetingCard'
import EmptyMeetings from '@/components/meetings/EmptyMeetings'
import WelcomeScreen from '@/components/WelcomeScreen'
import ProfileSetup from '@/components/ProfileSetup'
import type { Meeting } from '@/types/meeting'

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 첫 방문 웰컴 스크린 → 프로필 설정 이중 게이트
  if (user) {
    const profile = await getProfile(user.id)
    if (!profile.welcomed_at) {
      const settings = await getSiteSettings()
      return <WelcomeScreen nickname={profile.nickname} settings={settings} />
    }
    if (!profile.profile_completed_at || !profile.real_name) {
      return (
        <ProfileSetup
          nickname={profile.nickname}
          email={profile.email}
          phone={profile.phone}
          region={profile.region}
          realName={profile.real_name}
        />
      )
    }
  }

  const kstToday = getKSTToday()

  // Fetch active meetings from today onwards
  const { data: meetings, error: meetingsError } = await supabase
    .from('meetings')
    .select('*')
    .eq('status', 'active')
    .gte('date', kstToday)
    .order('date', { ascending: true })
    .order('time', { ascending: true })

  if (meetingsError) {
    throw new Error(`모임 목록 조회 실패: ${meetingsError.message}`)
  }

  const typedMeetings = (meetings ?? []) as Meeting[]

  if (typedMeetings.length === 0) {
    return (
      <div className="px-5 pt-6">
        <h1 className="text-xl font-extrabold text-primary-900 tracking-tight">모임 일정</h1>
        <EmptyMeetings />
      </div>
    )
  }

  const meetingIds = typedMeetings.map((m) => m.id)

  // Parallel: confirmed counts + user's confirmed regs + user's waitlisted regs
  const [countsResult, myRegsResult, myWaitlistResult] = await Promise.all([
    supabase.rpc('get_confirmed_counts', { meeting_ids: meetingIds }),
    user
      ? supabase
          .from('registrations')
          .select('meeting_id')
          .eq('user_id', user.id)
          .eq('status', 'confirmed')
          .in('meeting_id', meetingIds)
      : Promise.resolve({ data: [] as { meeting_id: string }[], error: null }),
    user
      ? supabase
          .from('registrations')
          .select('meeting_id')
          .eq('user_id', user.id)
          .eq('status', 'waitlisted')
          .in('meeting_id', meetingIds)
      : Promise.resolve({ data: [] as { meeting_id: string }[], error: null }),
  ])

  if (countsResult.error) {
    throw new Error(`참가자 수 조회 실패: ${countsResult.error.message}`)
  }
  if ('error' in myRegsResult && myRegsResult.error) {
    throw new Error(`내 신청 조회 실패: ${myRegsResult.error.message}`)
  }
  if ('error' in myWaitlistResult && myWaitlistResult.error) {
    throw new Error(`대기 신청 조회 실패: ${myWaitlistResult.error.message}`)
  }

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
  const waitlistedSet = new Set(
    (myWaitlistResult.data ?? []).map(
      (r: { meeting_id: string }) => r.meeting_id,
    ),
  )

  return (
    <div className="px-5 pt-6">
      <h1 className="text-xl font-extrabold text-primary-900 tracking-tight">모임 일정</h1>
      <div className="mt-4 flex flex-col gap-3">
        {typedMeetings.map((meeting) => (
          <MeetingCard
            key={meeting.id}
            meeting={meeting}
            confirmedCount={countMap.get(meeting.id) ?? 0}
            isRegistered={registeredSet.has(meeting.id)}
            isWaitlisted={waitlistedSet.has(meeting.id)}
          />
        ))}
      </div>
    </div>
  )
}
