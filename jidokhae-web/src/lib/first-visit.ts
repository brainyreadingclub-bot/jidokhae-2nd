/**
 * 「처음 오시나요?」 안내 판정 (순수 함수 — client 번들 안전, Supabase import 없음).
 *
 * 안내 문구의 사실 근거는 정기모임 소개글(prod `meetings.description`, 2026-10-16 조회)이다.
 * 소개글에 없는 약속(누가 맞이한다 등)은 안내에 넣지 않는다 — 문구는 `FirstVisitGuide.tsx`.
 */

import { hasRegularAttendance, type AttendanceRow } from '@/lib/discussion-eligibility'

/**
 * 이 모임 상세에 안내를 붙이는가.
 *
 * 화이트리스트 — `!== 'discussion'` 블랙리스트로 쓰지 않는다.
 * 기타 모임이 세 번째 유형으로 들어오면 블랙리스트는 정기모임 진행 순서를 그 모임에도 붙인다.
 */
export function showsFirstVisitGuide(meetingType: string | null | undefined): boolean {
  return meetingType === 'regular'
}

/**
 * 안내를 펼친 채로 보여주는가 — 정기모임에 다녀온 적이 없는 회원이면 펼친다.
 *
 * 「다녀왔다」는 토론모임 참여 자격과 **같은 기준**이다(`hasRegularAttendance`) —
 * confirmed·pending_transfer + 정기 + active + 모임일 경과. 기준이 둘이면 한쪽만 바뀐다.
 * 지금 이 모임을 신청해 둔 회원도 아직 다녀오지 않았으면 펼친다(첫 모임 직전이 가장 필요할 때다).
 *
 * `rows`가 null이면 이력을 **모른다**(조회 실패) — 접는다. 다녀온 회원에게 매번 펼쳐 보이는 것보다
 * 처음 온 회원이 한 번 눌러 여는 쪽이 비용이 작다.
 */
export function opensFirstVisitGuide(rows: AttendanceRow[] | null, kstToday: string): boolean {
  if (rows === null) return false
  return !hasRegularAttendance(rows, kstToday)
}
