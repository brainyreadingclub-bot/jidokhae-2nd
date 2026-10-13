/**
 * `topic_posted` 인앱 알림 문구 (알림함 NotificationList).
 *
 * payload가 두 모양이다 — **옛 알림도 알림함에 그대로 남아 있으므로 둘 다 읽는다.**
 *   - 새 (묶음 알림): { meeting_id, meeting_title, count, more }
 *       「발제 공개하기」(api/admin/topics/publish, 2026-10-12)가 만든다 — 작성 중 N개를 한 번에 공개하고 한 번 알린다.
 *       → 「발제 N개가 올라왔어요」 / 그 모임에 이미 공개된 발제가 있었으면 「발제 N개가 더 올라왔어요」
 *       (2026-10-10~12에는 DB 예약 작업 flush_topic_notifications가 같은 모양으로 만들었다 — 꺼졌다)
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
