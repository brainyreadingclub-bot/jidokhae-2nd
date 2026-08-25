import type { Metadata } from 'next'
import { loadMeetingDetail } from '@/lib/meeting-detail'
import { getMeeting } from '@/lib/meeting'
import { formatKoreanDate, formatKoreanTime, formatFee } from '@/lib/kst'
import MeetingDetailView from '@/components/next/MeetingDetailView'

type Props = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const meeting = await getMeeting(id)

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

export default async function NextMeetingDetailPage({ params }: Props) {
  const { id } = await params
  const data = await loadMeetingDetail(id)
  return <MeetingDetailView data={data} />
}
