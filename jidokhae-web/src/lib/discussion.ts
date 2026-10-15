import { cache } from 'react'
import { createServiceClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
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

export type TopicAnswerRow = Pick<TopicAnswer, 'topic_id' | 'user_id'>

/**
 * meeting의 **공개된** 발제 + 그 발제들의 답변(누가 어느 발제에 썼나).
 * 답변 행을 그대로 돌려주는 이유 — 이야기 탭이 진행률(답한 신청자 수)을 세려고 같은 조회를
 * 한 번 더 하고 있었다(2026-10-13 속도 점검). 한 번 읽어 두 곳에 쓴다.
 */
export const getTopicsAndAnswers = cache(
  async (meetingId: string): Promise<{ topics: DiscussionTopic[]; answers: TopicAnswerRow[] }> => {
    const supabase = createServiceClient()
    const { data: topics } = await supabase
      .from('discussion_topics')
      .select('*')
      .eq('meeting_id', meetingId)
      .not('published_at', 'is', null)
      .order('topic_no')
    if (!topics || topics.length === 0) return { topics: [], answers: [] }

    const topicIds = (topics as DiscussionTopic[]).map((t) => t.id)
    const { data: answers } = await supabase
      .from('topic_answers')
      .select('topic_id, user_id')
      .in('topic_id', topicIds)

    return {
      topics: topics as DiscussionTopic[],
      answers: (answers ?? []) as TopicAnswerRow[],
    }
  },
)

/** 발제마다 답변 수 + 내 답변 여부를 붙인다 (순수 계산) */
export function withTopicStats(
  topics: DiscussionTopic[],
  answers: TopicAnswerRow[],
  userId: string | null,
): TopicWithStats[] {
  return topics.map((t) => ({
    ...t,
    answer_count: answers.filter((a) => a.topic_id === t.id).length,
    my_answered: userId
      ? answers.some((a) => a.topic_id === t.id && a.user_id === userId)
      : false,
  }))
}

/** meeting의 **공개된** 발제 목록 + 답변 수 + 내 답변 여부 (작성 중은 회원 화면에 안 나간다) */
export const getTopicsWithStats = cache(
  async (meetingId: string, userId: string | null): Promise<TopicWithStats[]> => {
    const { topics, answers } = await getTopicsAndAnswers(meetingId)
    return withTopicStats(topics, answers, userId)
  },
)

/**
 * 발제 하나의 답변 목록 — 닉네임·공감 수·답글 수·내 공감 여부. 핀 먼저, 그다음 시간순.
 *
 * 🔒 답변·답글·공감은 **회원 본인 권한(쿠키 클라이언트)으로 읽는다** — DB 읽기 규칙(RLS)이
 * 응답 후 공개를 그대로 적용한다. 서버 판정(`topicAnswerView`)이 틀려도 DB가 한 번 더 막는다.
 * 닉네임만 service client로 붙인다(이미 읽을 수 있는 답변의 주인 닉네임만).
 *
 * `onlyUserId`를 주면 그 회원의 답만 가져온다 — 잠긴 발제에서 남의 답은 **조회 자체를 안 한다.**
 */
export const getAnswersWithMeta = cache(
  async (
    topicId: string,
    userId: string | null,
    onlyUserId: string | null = null,
  ): Promise<AnswerWithMeta[]> => {
    const supabase = await createClient()
    let query = supabase
      .from('topic_answers')
      .select('*')
      .eq('topic_id', topicId)
    if (onlyUserId) query = query.eq('user_id', onlyUserId)
    const { data: answers } = await query
      .order('pinned', { ascending: false })
      .order('created_at')
    if (!answers || answers.length === 0) return []

    const answerRows = answers as TopicAnswer[]
    const answerIds = answerRows.map((a) => a.id)
    const userIds = [...new Set(answerRows.map((a) => a.user_id))]

    const [{ data: profiles }, { data: reactions }, { data: replies }] =
      await Promise.all([
        createServiceClient().from('profiles').select('id, nickname').in('id', userIds),
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
 * 발제별 「답한 사람 수」 — **숫자만.** 잠긴 발제에서도 보여 준다(내용·이름은 안 나간다).
 * DB 함수 `get_topic_answerer_counts`가 숫자만 돌려준다. 함수가 아직 없으면(SQL 실행 전)
 * 답변의 발제·작성자 칸만 읽어 같은 숫자를 센다 — 본문은 어느 쪽에서도 읽지 않는다.
 */
export async function getTopicAnswererCounts(topicIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>(topicIds.map((id) => [id, 0]))
  if (topicIds.length === 0) return out
  const admin = createServiceClient()
  const { data, error } = await admin.rpc('get_topic_answerer_counts', { p_topic_ids: topicIds })
  if (!error && Array.isArray(data)) {
    for (const r of data as { topic_id: string; answerer_count: number }[]) {
      out.set(r.topic_id, Number(r.answerer_count) || 0)
    }
    return out
  }
  const { data: rows } = await admin
    .from('topic_answers')
    .select('topic_id, user_id')
    .in('topic_id', topicIds)
  const people = new Map<string, Set<string>>()
  for (const r of (rows ?? []) as TopicAnswerRow[]) {
    if (!people.has(r.topic_id)) people.set(r.topic_id, new Set())
    people.get(r.topic_id)!.add(r.user_id)
  }
  for (const [id, set] of people) out.set(id, set.size)
  return out
}

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
