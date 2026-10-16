export type DiscussionTopic = {
  id: string
  meeting_id: string
  topic_no: number
  title: string
  quote: string | null
  quote_page: string | null
  question: string
  author_id: string
  /** null = 작성 중(회원에게 안 보임). 「공개하기」가 채운다 — migration-topics-publish.sql */
  published_at: string | null
  /**
   * null = 신청자에게 아직 안 알림. DB 예약 작업이 묶어서 알린 뒤 채운다 — migration-topics-notify.sql.
   * 선택(?)인 이유: 그 SQL을 돌리기 전에는 칸이 없다
   */
  notified_at?: string | null
  /** 'admin' 운영자가 씀 | 'link' 발제자 링크로 받음 — migration-topics-presenter-link.sql (실행 전에는 없다) */
  source?: 'admin' | 'link'
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
