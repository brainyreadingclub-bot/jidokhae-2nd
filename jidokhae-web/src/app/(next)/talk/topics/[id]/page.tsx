import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/admin'
import { getUser } from '@/lib/auth'
import { getAnswersWithMeta } from '@/lib/discussion'
import { canWriteAnswer } from '@/lib/discussion-rules'
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
    .single()
  if (!topic) notFound()
  const typedTopic = topic as DiscussionTopic

  const [answers, myStatus] = await Promise.all([
    getAnswersWithMeta(id, user?.id ?? null),
    user
      ? admin
          .from('registrations')
          .select('status')
          .eq('user_id', user.id)
          .eq('meeting_id', typedTopic.meeting_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .then(({ data }) => data?.[0]?.status ?? null)
      : Promise.resolve(null),
  ])

  return (
    <div>
      <h1 className="mt-4 text-[15px] font-extrabold tracking-tight text-tg-900">
        발제 {typedTopic.topic_no} · {typedTopic.title}
      </h1>
      <TopicThread
        topic={typedTopic}
        answers={answers}
        canWrite={canWriteAnswer(myStatus)}
        myUserId={user?.id ?? null}
      />
    </div>
  )
}
