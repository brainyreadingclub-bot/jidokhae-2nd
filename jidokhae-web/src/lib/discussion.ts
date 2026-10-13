import { cache } from 'react'
import { createServiceClient } from '@/lib/supabase/admin'
import { countTopicsByMeeting, type TopicCounts } from '@/lib/topic-status'
import type {
  DiscussionTopic,
  TopicAnswer,
  TopicWithStats,
  AnswerWithMeta,
} from '@/types/discussion'

/**
 * 발제 조회 (Server Component 전용, React cache).
 * 쓰기는 전부 API Route — 여기는 읽기만.
 */

/** meeting의 **공개된** 발제 목록 + 답변 수 + 내 답변 여부 (작성 중은 회원 화면에 안 나간다) */
export const getTopicsWithStats = cache(
  async (meetingId: string, userId: string | null): Promise<TopicWithStats[]> => {
    const supabase = createServiceClient()
    const { data: topics } = await supabase
      .from('discussion_topics')
      .select('*')
      .eq('meeting_id', meetingId)
      .not('published_at', 'is', null)
      .order('topic_no')
    if (!topics || topics.length === 0) return []

    const topicIds = (topics as DiscussionTopic[]).map((t) => t.id)
    const { data: answers } = await supabase
      .from('topic_answers')
      .select('topic_id, user_id')
      .in('topic_id', topicIds)

    const answerRows = (answers ?? []) as Pick<TopicAnswer, 'topic_id' | 'user_id'>[]
    return (topics as DiscussionTopic[]).map((t) => ({
      ...t,
      answer_count: answerRows.filter((a) => a.topic_id === t.id).length,
      my_answered: userId
        ? answerRows.some((a) => a.topic_id === t.id && a.user_id === userId)
        : false,
    }))
  },
)

/** 발제 하나의 답변 목록 — 닉네임·공감 수·답글 수·내 공감 여부. 핀 먼저, 그다음 시간순 */
export const getAnswersWithMeta = cache(
  async (topicId: string, userId: string | null): Promise<AnswerWithMeta[]> => {
    const supabase = createServiceClient()
    const { data: answers } = await supabase
      .from('topic_answers')
      .select('*')
      .eq('topic_id', topicId)
      .order('pinned', { ascending: false })
      .order('created_at')
    if (!answers || answers.length === 0) return []

    const answerRows = answers as TopicAnswer[]
    const answerIds = answerRows.map((a) => a.id)
    const userIds = [...new Set(answerRows.map((a) => a.user_id))]

    const [{ data: profiles }, { data: reactions }, { data: replies }] =
      await Promise.all([
        supabase.from('profiles').select('id, nickname').in('id', userIds),
        supabase
          .from('answer_reactions')
          .select('answer_id, user_id')
          .in('answer_id', answerIds),
        supabase.from('answer_replies').select('answer_id').in('answer_id', answerIds),
      ])

    const nickname = new Map(
      ((profiles ?? []) as { id: string; nickname: string | null }[]).map((p) => [
        p.id,
        p.nickname ?? '회원',
      ]),
    )
    const reactionRows = (reactions ?? []) as { answer_id: string; user_id: string }[]
    const replyRows = (replies ?? []) as { answer_id: string }[]

    return answerRows.map((a) => ({
      ...a,
      nickname: nickname.get(a.user_id) ?? '회원',
      reaction_count: reactionRows.filter((r) => r.answer_id === a.id).length,
      reply_count: replyRows.filter((r) => r.answer_id === a.id).length,
      my_reacted: userId
        ? reactionRows.some((r) => r.answer_id === a.id && r.user_id === userId)
        : false,
    }))
  },
)

/**
 * 🔒 운영자 화면 전용 — 모임별 작성 중/공개 개수. **작성 중을 포함해 센다.**
 * 회원 화면에서 부르지 말 것 (회원 쪽은 getTopicsWithStats가 공개된 것만 준다).
 */
export async function getTopicCountsForAdmin(
  meetingIds: string[],
): Promise<Map<string, TopicCounts>> {
  if (meetingIds.length === 0) return new Map()
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('discussion_topics')
    .select('meeting_id, published_at')
    .in('meeting_id', meetingIds)
  return countTopicsByMeeting(
    (data ?? []) as { meeting_id: string; published_at: string | null }[],
  )
}
