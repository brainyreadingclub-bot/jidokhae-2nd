import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getKSTToday, getButtonState } from '@/lib/kst'
import MeetingDetailInfo from '@/components/meetings/MeetingDetailInfo'
import MeetingActionButton from '@/components/meetings/MeetingActionButton'
import AdminMeetingSection from '@/components/meetings/AdminMeetingSection'
import type { Meeting } from '@/types/meeting'
import Link from 'next/link'

type Props = {
  params: Promise<{ id: string }>
}

export default async function MeetingDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  // Fetch meeting
  const { data: meeting } = await supabase
    .from('meetings')
    .select('*')
    .eq('id', id)
    .single()

  const typedMeeting = meeting as Meeting | null

  if (!typedMeeting || typedMeeting.status === 'deleted') {
    notFound()
  }

  // Parallel: confirmed count, user's registration, user's role
  const [countsResult, myRegResult, profileResult] = await Promise.all([
    supabase.rpc('get_confirmed_counts', { meeting_ids: [id] }),
    supabase
      .from('registrations')
      .select('id')
      .eq('user_id', user.id)
      .eq('meeting_id', id)
      .eq('status', 'confirmed')
      .limit(1),
    supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single(),
  ])

  const confirmedCount = Number(
    (countsResult.data as { meeting_id: string; confirmed_count: number }[] | null)
      ?.find((c) => c.meeting_id === id)?.confirmed_count ?? 0,
  )
  const hasConfirmed = (myRegResult.data?.length ?? 0) > 0
  const isFull = confirmedCount >= typedMeeting.capacity
  const role = profileResult.data?.role ?? 'member'
  const isAdmin = role === 'admin'

  // Members cannot see deleting meetings
  if (typedMeeting.status === 'deleting' && !isAdmin) {
    notFound()
  }

  const kstToday = getKSTToday()
  const buttonState = getButtonState(
    typedMeeting.date,
    kstToday,
    hasConfirmed,
    isFull,
  )

  return (
    <div className="px-4 pt-4 pb-6">
      {/* Back link */}
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-4"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
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
      />

      {/* Action button */}
      <div className="mt-8">
        <MeetingActionButton buttonState={buttonState} />
      </div>

      {/* Admin section */}
      {isAdmin && (
        <AdminMeetingSection
          meetingId={typedMeeting.id}
          confirmedCount={confirmedCount}
        />
      )}
    </div>
  )
}
