import type { Metadata } from 'next'
import { after } from 'next/server'
import { loadMeetingDetail } from '@/lib/meeting-detail'
import { getMeeting } from '@/lib/meeting'
import { getUser } from '@/lib/auth'
import { resolveHomeUpcomingClick } from '@/lib/home-upcoming'
import { recordAppEvent } from '@/lib/app-events'
import { formatKoreanDate, formatKoreanTime, formatMeetingFeeForScreen } from '@/lib/kst'
import MeetingDetailView from '@/components/next/MeetingDetailView'
import RegionPublicComments from '@/components/next/review/RegionPublicComments'
import { Suspense } from 'react'

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string | string[]; pos?: string | string[] }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const meeting = await getMeeting(id)

  if (!meeting) {
    return { title: '지독해 - 독서모임' }
  }

  const description = `${formatKoreanDate(meeting.date)} ${formatKoreanTime(meeting.time)} · ${meeting.location} · 참가비 ${formatMeetingFeeForScreen(meeting.fee)}`

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

export default async function NextMeetingDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const data = await loadMeetingDetail(id)

  // 홈 「다가오는 정기모임」 카드에서 왔으면 기록표(app_events)에 한 줄 남긴다 (2026-10-13 결정).
  // 상세가 정상으로 열린 뒤에만 — 없는 모임(notFound)·비로그인(redirect)은 위에서 이미 끝났다.
  // 기록은 응답 뒤 after()에서, 실패해도 페이지는 그대로다. 신청·결제 코드는 건드리지 않는다
  const { from, pos } = await searchParams
  const user = await getUser()
  const click = resolveHomeUpcomingClick({ page: 'meeting', userId: user?.id, from, meetingId: id, pos })
  if (click) after(recordAppEvent({ ...click, userId: user?.id }))

  // 「지난 모임에서 남긴 한 줄」은 늦게 와도 된다 — 상세 본문이 이 조회를 기다리지 않게
  return (
    <MeetingDetailView
      data={data}
      afterInfo={
        <Suspense fallback={null}>
          <RegionPublicComments meetingId={data.meeting.id} meetingType={data.meeting.meeting_type ?? null} />
        </Suspense>
      }
    />
  )
}
