import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth'
import { getProfile } from '@/lib/profile'
import { getMeeting } from '@/lib/meeting'
import { getKSTToday, getButtonState } from '@/lib/kst'
import MeetingDetailInfo from '@/components/meetings/MeetingDetailInfo'
import MeetingActionButton from '@/components/meetings/MeetingActionButton'
import AdminMeetingSection from '@/components/meetings/AdminMeetingSection'
import type { RegistrationWithProfile } from '@/types/registration'

export default async function MeetingDetailContent({ id }: { id: string }) {
  const supabase = await createClient()
  const user = await getUser()

  if (!user) redirect('/auth/login')

  const typedMeeting = await getMeeting(id)

  if (!typedMeeting || typedMeeting.status === 'deleted') {
    notFound()
  }

  const [countsResult, myRegResult, myWaitlistResult] = await Promise.all([
    supabase.rpc('get_confirmed_counts', { meeting_ids: [id] }),
    supabase
      .from('registrations')
      .select('id, paid_amount, payment_id')
      .eq('user_id', user.id)
      .eq('meeting_id', id)
      .eq('status', 'confirmed')
      .limit(1),
    supabase
      .from('registrations')
      .select('id, paid_amount')
      .eq('user_id', user.id)
      .eq('meeting_id', id)
      .eq('status', 'waitlisted')
      .limit(1),
  ])

  if (countsResult.error) {
    throw new Error(`참가자 수 조회 실패: ${countsResult.error.message}`)
  }
  if (myRegResult.error) {
    throw new Error(`내 신청 조회 실패: ${myRegResult.error.message}`)
  }
  if (myWaitlistResult.error) {
    throw new Error(`대기 신청 조회 실패: ${myWaitlistResult.error.message}`)
  }

  const profile = await getProfile(user.id)

  const confirmedCount = Number(
    (countsResult.data as { meeting_id: string; confirmed_count: number }[] | null)
      ?.find((c) => c.meeting_id === id)?.confirmed_count ?? 0,
  )
  const myReg = myRegResult.data?.[0] ?? null
  const myWaitlistReg = myWaitlistResult.data?.[0] ?? null
  const hasConfirmed = myReg !== null
  const hasWaitlisted = myWaitlistReg !== null
  const isFull = confirmedCount >= typedMeeting.capacity
  const role = profile.role ?? 'member'
  const isAdmin = role === 'admin'
  const isEditorOrAdmin = role === 'admin' || role === 'editor'

  if (typedMeeting.status === 'deleting' && !isAdmin) {
    notFound()
  }

  let adminRegistrations: RegistrationWithProfile[] = []
  if (isEditorOrAdmin) {
    const { data: regs } = await supabase
      .from('registrations')
      .select('*, profiles(nickname, real_name)')
      .eq('meeting_id', id)
      .order('created_at', { ascending: false })

    adminRegistrations = (regs ?? []) as RegistrationWithProfile[]
  }

  const kstToday = getKSTToday()
  const buttonState = getButtonState(
    typedMeeting.date,
    kstToday,
    hasConfirmed,
    isFull,
    hasWaitlisted,
  )

  const hasStickyButton =
    buttonState.type === 'register' ||
    buttonState.type === 'full' ||
    buttonState.type === 'cancel' ||
    buttonState.type === 'join_waitlist' ||
    buttonState.type === 'waitlist_cancel'

  return (
    <div style={{ paddingBottom: hasStickyButton ? 'calc(9rem + env(safe-area-inset-bottom, 0px))' : '1.5rem' }}>
      <MeetingDetailInfo
        meeting={typedMeeting}
        confirmedCount={confirmedCount}
        capacity={typedMeeting.capacity}
      />

      <MeetingActionButton
        buttonState={buttonState}
        meetingId={typedMeeting.id}
        meetingTitle={typedMeeting.title}
        meetingFee={typedMeeting.fee}
        meetingDate={typedMeeting.date}
        userId={user.id}
        registrationId={myReg?.id}
        paidAmount={myReg?.paid_amount}
        waitlistRegistrationId={myWaitlistReg?.id}
        waitlistPaidAmount={myWaitlistReg?.paid_amount}
      />

      {isEditorOrAdmin && (
        <AdminMeetingSection
          meetingId={typedMeeting.id}
          meetingStatus={typedMeeting.status}
          confirmedCount={confirmedCount}
          registrations={adminRegistrations}
          role={role}
          meetingDate={typedMeeting.date}
        />
      )}
    </div>
  )
}
