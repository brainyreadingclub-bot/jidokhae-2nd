import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/admin'
import { getUser } from '@/lib/auth'
import { getKSTToday } from '@/lib/kst'
import { getAnswersWithMeta } from '@/lib/discussion'
import { getAnswerAccess } from '@/lib/answer-access'
import { topicApplyCta } from '@/lib/answer-access-rules'
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

  const [allAnswers, access, { data: meeting }, { data: counts }] = await Promise.all([
    getAnswersWithMeta(id, user?.id ?? null),
    getAnswerAccess(user?.id ?? null, typedTopic.meeting_id),
    admin
      .from('meetings')
      .select('id, date, status, capacity')
      .eq('id', typedTopic.meeting_id)
      .single(),
    admin.rpc('get_confirmed_counts', { meeting_ids: [typedTopic.meeting_id] }),
  ])

  // 🔒 읽기 자격이 없으면 남의 답변(본문·닉네임)은 **서버에서 걸러** 내려보내지 않는다 (2026-10-13).
  //    자기가 쓴 답변만 남긴다 — 취소한 사람이 자기 글이 사라진 줄 알면 안 된다
  const answers = access.canRead
    ? allAnswers
    : allAnswers.filter((a) => user && a.user_id === user.id)

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
        answerCount={allAnswers.length}
        canRead={access.canRead}
        canWrite={access.live}
        applyCta={cta}
        myUserId={user?.id ?? null}
      />
    </div>
  )
}
