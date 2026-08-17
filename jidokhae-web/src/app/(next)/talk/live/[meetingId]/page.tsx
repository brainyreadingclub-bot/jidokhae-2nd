import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/admin'
import { getTopicsWithStats, getAnswersWithMeta } from '@/lib/discussion'
import LiveMode, { type LiveTopic } from '@/components/next/LiveMode'
import type { Meeting } from '@/types/meeting'

/** 모임 자리 모드 — 서버에서 전부 조립 (정적, 실시간 아님) */
export default async function LivePage({
  params,
}: {
  params: Promise<{ meetingId: string }>
}) {
  const { meetingId } = await params
  const admin = createServiceClient()

  const { data: meeting } = await admin
    .from('meetings')
    .select('id, title, meeting_type')
    .eq('id', meetingId)
    .single()
  if (!meeting || (meeting as Meeting).meeting_type !== 'discussion') notFound()

  const topics = await getTopicsWithStats(meetingId, null)
  const liveTopics: LiveTopic[] = await Promise.all(
    topics.map(async (t) => {
      const answers = await getAnswersWithMeta(t.id, null)
      return {
        ...t,
        answers: answers.map((a) => ({
          nickname: a.nickname,
          body: a.body,
          pinned: a.pinned,
        })),
      }
    }),
  )

  return <LiveMode meetingTitle={(meeting as Meeting).title} topics={liveTopics} />
}
