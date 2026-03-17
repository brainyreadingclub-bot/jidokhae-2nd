import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/profile'
import { getKSTToday, getButtonState, formatKoreanDate, formatKoreanTime, formatFee } from '@/lib/kst'
import MeetingDetailInfo from '@/components/meetings/MeetingDetailInfo'
import MeetingActionButton from '@/components/meetings/MeetingActionButton'
import AdminMeetingSection from '@/components/meetings/AdminMeetingSection'
import type { Meeting } from '@/types/meeting'
import type { Metadata } from 'next'
import type { RegistrationWithProfile } from '@/types/registration'
import Link from 'next/link'

type Props = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const { data: meeting } = await supabase
    .from('meetings')
    .select('title, date, time, location, fee')
    .eq('id', id)
    .single()

  if (!meeting) {
    return { title: '지독해 - 독서모임' }
  }

  const description = `${formatKoreanDate(meeting.date)} ${formatKoreanTime(meeting.time)} · ${meeting.location} · 참가비 ${formatFee(meeting.fee)}`

  return {
    title: meeting.title,
    openGraph: {
      title: meeting.title,
      description,
      siteName: '지독해',
      type: 'website',
    },
  }
}

export default async function MeetingDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  // Fetch meeting
  const { data: meeting, error: meetingError } = await supabase
    .from('meetings')
    .select('*')
    .eq('id', id)
    .single()

  if (meetingError && meetingError.code !== 'PGRST116') {
    // PGRST116 = row not found → notFound()로 처리, 그 외는 진짜 에러
    throw new Error(`모임 조회 실패: ${meetingError.message}`)
  }

  const typedMeeting = meeting as Meeting | null

  if (!typedMeeting || typedMeeting.status === 'deleted') {
    notFound()
  }

  // Parallel: confirmed count + user's registration, profile from cache
  const [countsResult, myRegResult] = await Promise.all([
    supabase.rpc('get_confirmed_counts', { meeting_ids: [id] }),
    supabase
      .from('registrations')
      .select('id, paid_amount, payment_id')
      .eq('user_id', user.id)
      .eq('meeting_id', id)
      .eq('status', 'confirmed')
      .limit(1),
  ])

  if (countsResult.error) {
    throw new Error(`참가자 수 조회 실패: ${countsResult.error.message}`)
  }
  if (myRegResult.error) {
    throw new Error(`내 신청 조회 실패: ${myRegResult.error.message}`)
  }

  // cache hit — layout already fetched this in the same request
  const profile = await getProfile(user.id)

  const confirmedCount = Number(
    (countsResult.data as { meeting_id: string; confirmed_count: number }[] | null)
      ?.find((c) => c.meeting_id === id)?.confirmed_count ?? 0,
  )
  const myReg = myRegResult.data?.[0] ?? null
  const hasConfirmed = myReg !== null
  const isFull = confirmedCount >= typedMeeting.capacity
  const role = profile.role ?? 'member'
  const isAdmin = role === 'admin'

  // Members cannot see deleting meetings
  if (typedMeeting.status === 'deleting' && !isAdmin) {
    notFound()
  }

  // Fetch registrations for admin view
  let adminRegistrations: RegistrationWithProfile[] = []
  if (isAdmin) {
    const { data: regs } = await supabase
      .from('registrations')
      .select('*, profiles(nickname)')
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
  )

  const hasStickyButton =
    buttonState.type === 'register' ||
    buttonState.type === 'full' ||
    buttonState.type === 'cancel'

  return (
    <div className={`px-5 pt-4 ${hasStickyButton ? 'pb-36' : 'pb-6'}`}>
      {/* Back link */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-400 hover:text-primary-600 transition-colors mb-5"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
        목록으로
      </Link>

      {/* Meeting info */}
      <MeetingDetailInfo
        meeting={typedMeeting}
        confirmedCount={confirmedCount}
        capacity={typedMeeting.capacity}
      />

      {/* Action button (sticky for register/full/cancel, inline for attended/complete) */}
      <MeetingActionButton
        buttonState={buttonState}
        meetingId={typedMeeting.id}
        meetingTitle={typedMeeting.title}
        meetingFee={typedMeeting.fee}
        meetingDate={typedMeeting.date}
        userId={user.id}
        registrationId={myReg?.id}
        paidAmount={myReg?.paid_amount}
      />

      {/* Admin section */}
      {isAdmin && (
        <AdminMeetingSection
          meetingId={typedMeeting.id}
          meetingStatus={typedMeeting.status}
          confirmedCount={confirmedCount}
          registrations={adminRegistrations}
        />
      )}
    </div>
  )
}
