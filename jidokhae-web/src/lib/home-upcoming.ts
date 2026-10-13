/**
 * 홈 「다가오는 정기모임」 고르기 (순수 함수 — 2026-10-13 대표님 결정 + 2차 수정).
 *
 * - 후보는 page가 넘긴다: 정기모임 · active · 오늘 이후 · 내가 신청 안 한 것 · **마감 아닌 것**, 날짜·시간순
 * - 회원이 정기모임에 확정된 적이 있는 지역(`homeRegions`)이 있으면 **그 지역 모임으로 먼저 채우고**,
 *   남은 자리는 날짜순(다른 지역 포함)으로 채운다. 기록이 없으면 그냥 날짜순 3개
 * - 고른 뒤에는 **날짜순으로 다시 세운다** — 날짜 칸이 세로로 놓인 목록이라 순서가 뒤섞이면 읽기 어렵다
 */
export function pickUpcomingRegulars<T extends { id: string; region: string | null }>(
  candidates: T[],
  homeRegions: ReadonlySet<string>,
  limit = 3,
): T[] {
  const preferred = candidates.filter((m) => m.region && homeRegions.has(m.region)).slice(0, limit)
  const picked = new Set(preferred.map((m) => m.id))
  const rest = candidates.filter((m) => !picked.has(m.id)).slice(0, limit - preferred.length)
  const chosen = new Set([...picked, ...rest.map((m) => m.id)])
  // candidates가 이미 날짜순이므로 원래 순서를 지키면 날짜순이다
  return candidates.filter((m) => chosen.has(m.id))
}
