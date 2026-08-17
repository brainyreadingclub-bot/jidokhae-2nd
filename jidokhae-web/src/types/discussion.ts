export type DiscussionTopic = {
  id: string
  meeting_id: string
  topic_no: number
  title: string
  quote: string | null
  quote_page: string | null
  question: string
  author_id: string
  created_at: string
  updated_at: string
}

export type TopicAnswer = {
  id: string
  topic_id: string
  user_id: string
  body: string
  pinned: boolean
  created_at: string
  updated_at: string
}

export type AnswerReply = {
  id: string
  answer_id: string
  user_id: string
  body: string
  created_at: string
}

/** 화면용 합성 타입 — lib/discussion.ts가 조립 */
export type TopicWithStats = DiscussionTopic & {
  answer_count: number
  my_answered: boolean
}

export type AnswerWithMeta = TopicAnswer & {
  nickname: string
  reaction_count: number
  reply_count: number
  my_reacted: boolean
}
