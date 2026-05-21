import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth'
import { getProfile } from '@/lib/profile'
import { getKSTToday } from '@/lib/kst'
import { getSiteSettings } from '@/lib/site-settings'
import { startDiagnostic } from '@/lib/diagnostic-log'
import MeetingsView from '@/components/meetings/MeetingsView'
import EmptyMeetings from '@/components/meetings/EmptyMeetings'
import WelcomeScreen from '@/components/WelcomeScreen'
import ProfileSetup from '@/components/ProfileSetup'
import type { Meeting } from '@/types/meeting'

export default async function HomeContent() {
  // 진단 로그 — 2026-05-19 인시던트 후 임시 추가, 안정화 후 제거 예정
  const diag = startDiagnostic('home')
  diag.stage('start')

  const supabase = await createClient()

  diag.stage('getUser start')
  const tUser = diag.elapsed()
  const user = await getUser()
  diag.stage('getUser done', ` in ${diag.elapsed() - tUser}ms (user: ${user ? 'yes' : 'no'})`)

  // 첫 방문 웰컴 스크린 → 프로필 설정 이중 게이트
  if (user) {
    diag.stage('getProfile (gate) start')
    const tProfile = diag.elapsed()
    const profile = await getProfile(user.id)
    diag.stage('getProfile (gate) done', ` in ${diag.elapsed() - tProfile}ms`)

    if (!profile.welcomed_at) {
      diag.stage('getSiteSettings start')
      const tSettings = diag.elapsed()
      const settings = await getSiteSettings()
      diag.stage('getSiteSettings done', ` in ${diag.elapsed() - tSettings}ms`)
      diag.stage('complete (welcome screen)')
      return <WelcomeScreen nickname={profile.nickname} settings={settings} />
    }
    if (!profile.profile_completed_at || !profile.real_name) {
      diag.stage('complete (profile setup)')
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

  const profile = user ? await getProfile(user.id) : null
  const role = profile?.role ?? null
  const nickname = profile?.nickname ?? ''
  const isPrivileged = role === 'admin' || role === 'editor'

  const kstToday = getKSTToday()

  diag.stage('meetings.select start')
  const tMeetings = diag.elapsed()
  const { data: meetings, error: meetingsError } = await supabase
    .from('meetings')
    .select('*')
    .eq('status', 'active')
    .gte('date', kstToday)
    .order('date', { ascending: true })
    .order('time', { ascending: true })
  diag.stage('meetings.select done', ` in ${diag.elapsed() - tMeetings}ms (rows: ${meetings?.length ?? 0})${meetingsError ? ` ERROR: ${meetingsError.message}` : ''}`)

  if (meetingsError) {
    throw new Error(`모임 목록 조회 실패: ${meetingsError.message}`)
  }

  const typedMeetings = (meetings ?? []) as Meeting[]

  if (typedMeetings.length === 0) {
    diag.stage('complete (empty)')
    return <EmptyMeetings showBrowseLink />
  }

  const meetingIds = typedMeetings.map((m) => m.id)

  diag.stage('parallel queries start')
  const tParallel = diag.elapsed()
  const [countsResult, myRegsResult, myWaitlistResult, myPendingResult] = await Promise.all([
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
    user
      ? supabase
          .from('registrations')
          .select('meeting_id')
          .eq('user_id', user.id)
          .eq('status', 'pending_transfer')
          .in('meeting_id', meetingIds)
      : Promise.resolve({ data: [] as { meeting_id: string }[], error: null }),
  ])
  diag.stage('parallel queries done', ` in ${diag.elapsed() - tParallel}ms`)

  if (countsResult.error) {
    throw new Error(`참가자 수 조회 실패: ${countsResult.error.message}`)
  }
  if ('error' in myRegsResult && myRegsResult.error) {
    throw new Error(`내 신청 조회 실패: ${myRegsResult.error.message}`)
  }
  if ('error' in myWaitlistResult && myWaitlistResult.error) {
    throw new Error(`대기 신청 조회 실패: ${myWaitlistResult.error.message}`)
  }
  if ('error' in myPendingResult && myPendingResult.error) {
    throw new Error(`입금대기 조회 실패: ${myPendingResult.error.message}`)
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
  const pendingArr = (myPendingResult.data ?? []).map(
    (r: { meeting_id: string }) => r.meeting_id,
  )

  diag.stage('complete')

  return (
    <div className="mt-4">
      <MeetingsView
        meetings={typedMeetings}
        countMap={countMap}
        registeredSet={registeredArr}
        waitlistedSet={waitlistedArr}
        pendingTransferSet={pendingArr}
        nickname={nickname}
        kstToday={kstToday}
        isPrivileged={isPrivileged}
      />
    </div>
  )
}
