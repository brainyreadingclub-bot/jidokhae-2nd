import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth'
import { getProfile } from '@/lib/profile'
import { getKSTToday } from '@/lib/kst'
import { getSiteSettings } from '@/lib/site-settings'
import MeetingsView from '@/components/meetings/MeetingsView'
import EmptyMeetings from '@/components/meetings/EmptyMeetings'
import WelcomeScreen from '@/components/WelcomeScreen'
import ProfileSetup from '@/components/ProfileSetup'
import type { Meeting } from '@/types/meeting'

export default async function HomeContent() {
  const supabase = await createClient()
  const user = await getUser()

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
    return <EmptyMeetings showBrowseLink />
  }

  const meetingIds = typedMeetings.map((m) => m.id)

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

  const countMap: Record<string, number> = {}
  for (const c of (countsResult.data ?? []) as { meeting_id: string; confirmed_count: number }[]) {
    countMap[c.meeting_id] = Number(c.confirmed_count)
  }
  const registeredArr = (myRegsResult.data ?? []).map(
    (r: { meeting_id: string }) => r.meeting_id,
  )
  const waitlistedArr = (myWaitlistResult.data ?? []).map(
    (r: { meeting_id: string }) => r.meeting_id,
  )

  return (
    <div className="mt-4">
      <MeetingsView
        meetings={typedMeetings}
        countMap={countMap}
        registeredSet={registeredArr}
        waitlistedSet={waitlistedArr}
        kstToday={kstToday}
      />
    </div>
  )
}
