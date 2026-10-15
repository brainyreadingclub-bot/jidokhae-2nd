import { notFound } from 'next/navigation'
import { after } from 'next/server'
import { createServiceClient } from '@/lib/supabase/admin'
import { getUser } from '@/lib/auth'
import { getKSTToday } from '@/lib/kst'
import { getAnswersWithMeta, getTopicAnswererCounts } from '@/lib/discussion'
import { getAnswerAccess, getMyAnsweredTopicIds, viewForTopic } from '@/lib/answer-access'
import { canSeeOthersAnswers, topicApplyCta } from '@/lib/answer-access-rules'
import { recordAppEvent } from '@/lib/app-events'
import { isDiscussionApplyOpen } from '@/lib/discussion-rules'
import TopicThread from '@/components/next/TopicThread'
import type { DiscussionTopic } from '@/types/discussion'

export default async function TopicPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getUser()
  const admin = createServiceClient()

  const { data: topic } = await admin
    .from('discussion_topics')
    .select('*')
    .eq('id', id)
    .not('published_at', 'is', null)
    .single()
  // 작성 중인 발제는 주소를 알아도 열리지 않는다
  if (!topic) notFound()
  const typedTopic = topic as DiscussionTopic

  const userId = user?.id ?? null
  const [access, mineIds, answererCounts, { data: meeting }, { data: counts }] = await Promise.all([
    getAnswerAccess(userId, typedTopic.meeting_id),
    getMyAnsweredTopicIds(userId, [id]),
    getTopicAnswererCounts([id]),
    admin
      .from('meetings')
      .select('id, date, status, capacity')
      .eq('id', typedTopic.meeting_id)
      .single(),
    admin.rpc('get_confirmed_counts', { meeting_ids: [typedTopic.meeting_id] }),
  ])

  // 🔒 응답 후 공개 (2026-10-15): 남의 답을 볼 수 없는 상태면 **남의 답은 조회 자체를 안 한다.**
  //    자기 답만 가져온다 — 취소한 사람이 자기 글이 사라진 줄 알면 안 된다.
  //    조회는 회원 권한으로 해서 DB 규칙이 한 번 더 막는다 (lib/discussion.ts getAnswersWithMeta)
  const view = viewForTopic(access, mineIds.has(id))
  const answers = canSeeOthersAnswers(view)
    ? await getAnswersWithMeta(id, userId)
    : userId
      ? await getAnswersWithMeta(id, userId, userId)
      : []
  const answererCount = answererCounts.get(id) ?? 0

  if (userId) {
    after(
      recordAppEvent({
        event: 'topic.view',
        userId,
        meetingId: typedTopic.meeting_id,
        props: { topic_no: typedTopic.topic_no, access: view, answerers: answererCount },
      }),
    )
  }

  const confirmedCount = Number(
    ((counts ?? []) as { confirmed_count: number }[])[0]?.confirmed_count ?? 0,
  )
  const cta = meeting
    ? topicApplyCta({
        waitlisted: access.waitlisted,
        applyOpen: isDiscussionApplyOpen(meeting.date, getKSTToday()),
        meetingActive: meeting.status === 'active',
        confirmedCount,
        capacity: meeting.capacity,
      })
    : 'closed'

  return (
    <div>
      <h1 className="mt-4 text-[15px] font-extrabold tracking-tight text-tg-900">
        발제 {typedTopic.topic_no} · {typedTopic.title}
      </h1>
      <TopicThread
        topic={typedTopic}
        answers={answers}
        answererCount={answererCount}
        view={view}
        canWrite={access.live}
        applyCta={cta}
        myUserId={user?.id ?? null}
      />
    </div>
  )
}
