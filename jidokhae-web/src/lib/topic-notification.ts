/**
 * `topic_posted` 인앱 알림 문구 (알림함 NotificationList + 공개 확인 창 미리보기가 함께 쓴다).
 *
 * payload가 두 모양이다 — **옛 알림도 알림함에 그대로 남아 있으므로 둘 다 읽는다.**
 *   - 새 (2026-10-09~, 공개하기 1번 = 알림 1건): { meeting_id, meeting_title, count, more }
 *       → 「발제문 N개가 올라왔어요」 / 이미 공개된 발제가 있던 모임이면 「발제문 N개가 더 올라왔어요」
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
  return more ? `발제문 ${count}개가 더 올라왔어요` : `발제문 ${count}개가 올라왔어요`
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
