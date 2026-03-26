import { Suspense } from 'react'
import { getMeeting } from '@/lib/meeting'
import { formatKoreanDate, formatKoreanTime, formatFee } from '@/lib/kst'
import MeetingDetailContent from '@/components/meetings/MeetingDetailContent'
import MeetingDetailSkeleton from '@/components/skeletons/MeetingDetailSkeleton'
import type { Metadata } from 'next'
import Link from 'next/link'

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
      images: [
        {
          url: 'https://brainy-club.com/og-image.png',
          width: 1200,
          height: 630,
          alt: '지독해 — 로컬 기반 독서모임',
        },
      ],
    },
  }
}

export default async function MeetingDetailPage({ params }: Props) {
  const { id } = await params

  return (
    <div className="px-5 pt-4">
      {/* Back link — 즉시 렌더 */}
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

      <Suspense fallback={<MeetingDetailSkeleton />}>
        <MeetingDetailContent id={id} />
      </Suspense>
    </div>
  )
}
