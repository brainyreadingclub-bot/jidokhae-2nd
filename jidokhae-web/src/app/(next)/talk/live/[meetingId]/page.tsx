import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/admin'
import { getUser } from '@/lib/auth'
import { getTopicsWithStats, getAnswersWithMeta } from '@/lib/discussion'
import { getAnswerAccess, viewForTopic } from '@/lib/answer-access'
import { canSeeOthersAnswers } from '@/lib/answer-access-rules'
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

  const user = await getUser()
  const [topics, access] = await Promise.all([
    getTopicsWithStats(meetingId, user?.id ?? null),
    getAnswerAccess(user?.id ?? null, meetingId),
  ])
  // 🔒 답변은 그 모임 신청자 + 운영진만 (2026-10-13), 신청자는 자기가 답한 발제만 (응답 후 공개, 2026-10-15).
  //    못 보는 발제는 답변을 안 내려보낸다 — 화면 판정과 같은 함수(viewForTopic)를 쓴다
  const liveTopics: LiveTopic[] = await Promise.all(
    topics.map(async (t) => {
      const answers = canSeeOthersAnswers(viewForTopic(access, t.my_answered))
        ? await getAnswersWithMeta(t.id, null)
        : []
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
