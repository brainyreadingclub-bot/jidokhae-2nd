import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatKoreanDate, formatKoreanTime, formatMeetingFee } from '@/lib/kst'
import MeetingDetailInfo from '@/components/meetings/MeetingDetailInfo'
import TrackMeetingView from '@/components/analytics/TrackMeetingView'
import type { Meeting } from '@/types/meeting'
import type { Metadata } from 'next'

type Props = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const { data: meeting } = await supabase
    .from('meetings')
    .select('title, date, time, location, fee, meeting_type')
    .eq('id', id)
    .single()

  // 토론모임은 공개 상세가 404다 — 제목·장소가 OG 메타로 새 나가지 않게 여기서도 막는다
  if (!meeting || meeting.meeting_type === 'discussion') {
    return { title: '지독해 - 독서모임' }
  }

  const description = `${formatKoreanDate(meeting.date)} ${formatKoreanTime(meeting.time)} · ${meeting.location} · 참가비 ${formatMeetingFee(meeting.fee)}`

  return {
    title: `${meeting.title} | 지독해`,
    description,
    openGraph: {
      title: meeting.title,
      description,
      siteName: '지독해',
      type: 'website',
    },
  }
}

export default async function PublicMeetingDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  // 비로그인 공개 페이지 — 민감 컬럼(chat_link/detail_address/reading_link)은
  // 제외 (Phase 3 M7 Step 2.5, 검토문서 §4 커밋 4)
  const { data: meeting, error: meetingError } = await supabase
    .from('meetings')
    .select('id, title, description, date, time, location, venue_id, capacity, fee, status, meeting_type, region, is_featured, created_at, updated_at')
    .eq('id', id)
    .single()

  if (meetingError && meetingError.code !== 'PGRST116') {
    throw new Error(`모임 조회 실패: ${meetingError.message}`)
  }

  const typedMeeting = meeting as Meeting | null

  if (!typedMeeting || typedMeeting.status === 'deleted' || typedMeeting.status === 'deleting') {
    notFound()
  }

  // 🔴 토론모임은 비로그인 공개 상세에도 **플래그와 무관하게** 노출하지 않는다 (목록과 같은 근거).
  // 로그인 회원의 `/meet/[id]`·`/meetings/[id]`는 살려둔다 — 이미 신청한 사람이 자기 신청을
  // 못 보면 안 되고, 미자격자에게도 블라인드는 금지다(보이되 신청만 잠근다)
  if (typedMeeting.meeting_type === 'discussion') {
    notFound()
  }

  const { data: countsResult, error: countsError } = await supabase.rpc(
    'get_confirmed_counts',
    { meeting_ids: [id] }
  )

  if (countsError) {
    throw new Error(`참가자 수 조회 실패: ${countsError.message}`)
  }

  const confirmedCount = Number(
    (countsResult as { meeting_id: string; confirmed_count: number }[] | null)
      ?.find((c) => c.meeting_id === id)?.confirmed_count ?? 0,
  )

  return (
    <div className="px-5 pt-4 pb-6">
      {/* Back link */}
      <Link
        href="/policy/meetings"
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

      <TrackMeetingView
        meetingId={typedMeeting.id}
        title={typedMeeting.title}
        fee={typedMeeting.fee}
      />

      {/* Meeting info */}
      <MeetingDetailInfo
        meeting={typedMeeting}
        confirmedCount={confirmedCount}
        capacity={typedMeeting.capacity}
        isPrivileged={false}
      />

      {/* Login CTA */}
      <div className="mt-8">
        <Link
          href="/auth/login"
          prefetch={false}
          className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] px-6 py-4 text-sm font-bold text-white shadow-sm transition-all hover:shadow-md active:scale-[0.98]"
          style={{ backgroundColor: 'var(--color-primary-600)' }}
        >
          로그인하고 신청하기
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>
        <p className="mt-3 text-center text-small text-neutral-400">
          카카오 계정으로 간편하게 신청할 수 있어요
        </p>
      </div>
    </div>
  )
}
