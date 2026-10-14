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

/** 홈 「다가오는 정기모임」 카드 → 모임 상세 링크의 출처 표시 */
export const FROM_HOME_UPCOMING = 'home_upcoming'
/** 「다른 일정도 보기」 → 모임 목록 링크의 출처 표시 */
export const FROM_HOME_UPCOMING_MORE = 'home_upcoming_more'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** 기록표(`app_events`)에 남길 이벤트 한 건. 이름은 `lib/app-events.ts`의 목록에 있는 것만 */
export type HomeUpcomingClickEvent =
  | { event: 'home_upcoming.meeting_click'; meetingId: string; props: { pos: number | null } }
  | { event: 'home_upcoming.more_click'; meetingId: null; props: Record<string, never> }

/**
 * 도착한 요청이 홈 「다가오는 정기모임」 클릭인지 판정하고, 남길 이벤트를 만든다 (순수 함수).
 * null = 기록하지 않는다.
 *
 * - 로그인한 회원만 센다 (세는 법이 회원 단위다)
 * - 모임 상세는 `from=home_upcoming`, 목록은 `from=home_upcoming_more`일 때만 — 다른 출처는 무시
 * - meeting_id는 UUID일 때만 — 표의 uuid 칸을 지킨다
 * - pos는 1~3 정수일 때만 남기고, 아니면 null (위치가 이상해도 클릭 자체는 센다)
 */
export function resolveHomeUpcomingClick(input: {
  page: 'meeting' | 'list'
  userId: string | null | undefined
  from: string | string[] | undefined
  meetingId?: string | null
  pos?: string | string[] | undefined
}): HomeUpcomingClickEvent | null {
  if (!input.userId) return null
  const from = Array.isArray(input.from) ? input.from[0] : input.from

  if (input.page === 'list') {
    if (from !== FROM_HOME_UPCOMING_MORE) return null
    return { event: 'home_upcoming.more_click', meetingId: null, props: {} }
  }

  if (from !== FROM_HOME_UPCOMING) return null
  if (!input.meetingId || !UUID_RE.test(input.meetingId)) return null
  const rawPos = Array.isArray(input.pos) ? input.pos[0] : input.pos
  const n = rawPos !== undefined && /^\d+$/.test(rawPos) ? Number(rawPos) : NaN
  const pos = Number.isInteger(n) && n >= 1 && n <= 3 ? n : null
  return { event: 'home_upcoming.meeting_click', meetingId: input.meetingId, props: { pos } }
}
