/**
 * `topic_posted` 인앱 알림 문구 (알림함 NotificationList).
 *
 * payload가 두 모양이다 — **옛 알림도 알림함에 그대로 남아 있으므로 둘 다 읽는다.**
 *   - 새 (2026-10-10~, 묶음 알림): { meeting_id, meeting_title, count, more }
 *       DB 함수 flush_topic_notifications(supabase/migration-topics-notify.sql)가 만든다 —
 *       마지막 등록 후 10분 동안 추가 등록이 없으면 그동안 올라온 발제를 한 번에 알린다.
 *       → 「발제 N개가 올라왔어요」 / 그 모임에 이미 알린 발제가 있으면 「발제 N개가 더 올라왔어요」
 *       🔴 키 이름을 바꾸면 SQL 함수의 jsonb_build_object도 같이 바꾼다
 *   - 옛 (발제 1건 등록 = 알림 1건): { meeting_id, topic_no, title }
 *       → 「새 발제문이 올라왔어요」 + 「발제 N · 제목」
 */
export type TopicPostedPayload = {
  meeting_id: string
  meeting_title: string
  count: number
  more: boolean
}

export function topicPostedTitle(count: number, more: boolean): string {
  return more ? `발제 ${count}개가 더 올라왔어요` : `발제 ${count}개가 올라왔어요`
}

export function renderTopicPosted(p: Record<string, unknown>): { title: string; sub?: string } {
  const count = Number(p.count)
  if (Number.isFinite(count) && count > 0) {
    return {
      title: topicPostedTitle(count, p.more === true),
      sub: p.meeting_title ? String(p.meeting_title) : undefined,
    }
  }
  return {
    title: '새 발제문이 올라왔어요',
    sub: p.title ? `발제 ${p.topic_no ?? ''} · ${p.title}` : undefined,
  }
}
