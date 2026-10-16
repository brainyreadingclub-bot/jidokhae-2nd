/**
 * 운영 화면 들어오는 문 — 누가 어느 구역에 들어오나 (2026-10-16 대표님 결정).
 *
 * - 총괄(admin)·운영진(editor) → 운영 화면 `/admin` 전체
 * - 스텝(`role='member'` + `is_staff`) → **스텝 구역 `/staff`만.** 운영 화면은 통째로 닫혀 있다
 * - 회원 → 둘 다 없음
 *
 * 왜 구역을 따로 두나 — 「허용 목록 방식」. 운영 화면에 스텝을 들여보내고 페이지마다 막으면,
 * 레이아웃 검사만 믿는 페이지 하나를 빠뜨렸을 때 저절로 열린다. 스텝 구역에는
 * 아래 STAFF_PAGES에 적힌 화면만 존재하므로, 새 운영 페이지가 생겨도 스텝에게 열리지 않는다.
 */

/** 스텝 구역에 있는 화면 전부 — 여기 없는 화면은 스텝에게 없다 */
export const STAFF_PAGES = [
  '/staff/topics', // 다가오는 토론모임 목록
  '/staff/topics/[id]', // 그 모임의 발제문 쓰기·고치기·공개
] as const

export const STAFF_HOME = '/staff/topics'

export type AdminArea = 'admin' | 'staff' | 'none'

export function adminAreaOf(p: { role: string; is_staff: boolean | null } | null | undefined): AdminArea {
  if (!p) return 'none'
  if (p.role === 'admin' || p.role === 'editor') return 'admin'
  if (p.is_staff === true) return 'staff'
  return 'none'
}

/**
 * 운영 화면에서 신청자 행에 붙여 읽는 회원 칸 — 전화번호는 총괄만 (2026-04-23 매트릭스, 2026-10-16 재확인).
 * 화면에서 숨기는 것이 아니라 **불러오는 단계에서 뺀다** — 운영진 화면에는 값 자체가 오지 않는다.
 */
export function registrantProfileColumns(role: string): string {
  return role === 'admin' ? 'nickname, real_name, phone' : 'nickname, real_name'
}
