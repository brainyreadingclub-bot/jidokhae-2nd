export type AppNotificationType =
  | 'answer_reply'
  | 'answer_reaction'
  | 'topic_posted'
  | 'flash_opened'
  | 'flash_cancelled'
  | 'registration_confirmed'
  | 'announcement'

export type AppNotification = {
  id: string
  user_id: string
  type: AppNotificationType
  /** type별 자유 형식 — actor_nickname, meeting_id, topic_id, answer_id, preview 등 */
  payload: Record<string, unknown>
  read_at: string | null
  created_at: string
}
