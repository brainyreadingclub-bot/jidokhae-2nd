/**
 * 모임별 발제문 상태 — 운영자 첫 화면 줄 · 모임 상세 카드 · 발제문 관리 상단이 함께 쓴다 (순수 함수).
 * 목표 개수는 저장하지 않는다(2026-10-09 대표님) — 개수와 상태만 말한다.
 */

export type TopicCounts = { draft: number; published: number }

export const NO_TOPICS: TopicCounts = { draft: 0, published: 0 }

/** 「발제문 없음」 / 「작성 중 N개」 / 「공개됨 N개」 / 섞이면 「공개됨 3개 · 작성 중 2개」 */
export function topicStatusLabel(c: TopicCounts): string {
  if (c.draft === 0 && c.published === 0) return '발제문 없음'
  if (c.published === 0) return `작성 중 ${c.draft}개`
  if (c.draft === 0) return `공개됨 ${c.published}개`
  return `공개됨 ${c.published}개 · 작성 중 ${c.draft}개`
}

/** 운영자가 손댈 일이 남았나 — 발제문이 없거나, 작성 중이 하나라도 있으면. 전부 공개됐으면 할 일 없음 */
export function needsTopicAction(c: TopicCounts): boolean {
  return c.draft > 0 || c.published === 0
}

export function countTopicsByMeeting(
  rows: { meeting_id: string; published_at: string | null }[],
): Map<string, TopicCounts> {
  const map = new Map<string, TopicCounts>()
  for (const r of rows) {
    const c = map.get(r.meeting_id) ?? { draft: 0, published: 0 }
    if (r.published_at === null) c.draft += 1
    else c.published += 1
    map.set(r.meeting_id, c)
  }
  return map
}

/** 「공개 안 한 발제가 있어요」를 띄우는 기준 — 모임 사흘 전(D-3)부터 (2026-10-12 대표님) */
export const TOPIC_PUBLISH_WARN_DAYS = 3

/**
 * 작성 중 발제가 남아 있는데 모임이 사흘 안으로 다가왔나 (모임 당일 포함, 지난 모임은 제외).
 * daysUntil = 모임일 − 오늘(한국 날짜, getDaysUntil).
 */
export function isTopicPublishLate(c: TopicCounts, daysUntil: number): boolean {
  return c.draft > 0 && daysUntil >= 0 && daysUntil <= TOPIC_PUBLISH_WARN_DAYS
}
