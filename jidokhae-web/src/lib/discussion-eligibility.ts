/**
 * 토론모임 참여 자격 판정 (순수 함수 — client 번들 안전, Supabase import 없음).
 *
 * 확정 규칙: 검토문서/2026-08-22-토론자격-판정규칙.md §1-7
 *
 *   토론모임 신청 자격 = 아래 둘 중 하나
 *     (A) 운영 주체 — profiles.role ∈ {admin, editor} OR profiles.is_staff = true  (= isCurator)
 *     (B) 정기모임 실참여 1건 이상
 *           registrations.status ∈ ('confirmed', 'pending_transfer')
 *           AND meetings.meeting_type = 'regular'
 *           AND meetings.status = 'active'
 *           AND meetings.date < (KST 오늘)          -- 당일은 아직 미경과
 *
 * 🔴 **기간 윈도우가 없다(평생 기준).** 2026-08-14 결정.
 *    모양이 거의 같은 `isAskEligibleMeeting`(lib/asks-pure.ts)에는 60일 윈도우가 있다.
 *    그건 물어보기 전용 이유(과거 소급 스팸 방지)이지 자격 규칙이 아니다 —
 *    **재사용하지 말 것.** 공유하는 것은 `PARTICIPATED_STATUSES` 상수 하나뿐이다.
 *    이 규칙은 `__tests__/discussion-eligibility.test.ts`가 회귀로 못 박고 있다
 *    ("60일보다 오래된 참여도 자격을 준다").
 */

import { getDaysUntil } from '@/lib/kst'
import { PARTICIPATED_STATUSES } from '@/lib/registration-status'

/** 자격 판정의 최소 입력 — `registrations` 한 행 + 조인된 meetings */
export type AttendanceRow = {
  status: string
  meetings: { date: string; meeting_type: string; status: string } | null
}

/**
 * 이 신청 한 건이 "정기모임에 실제로 다녀온 것"으로 세어지는가.
 *
 * 이름을 `isDiscussionEligibleMeeting`처럼 짓지 않았다 — `isAskEligibleMeeting` 옆에 두면
 * 같은 가족처럼 보여 재사용을 부른다. 이 함수가 묻는 것은 "정기에 와 봤는가" 하나다.
 */
export function countsAsRegularAttendance(row: AttendanceRow, kstToday: string): boolean {
  // status — 계좌이체(pending_transfer)를 반드시 포함. 상수 파일에 사고 기록이 있다
  if (!(PARTICIPATED_STATUSES as readonly string[]).includes(row.status)) return false

  const meeting = row.meetings
  if (!meeting) return false

  // 화이트리스트 — `<> 'discussion'` 블랙리스트로 쓰지 않는다.
  // 2단계 번개모임이 세 번째 유형으로 들어오면 블랙리스트는 번개를 정기로 세어버린다.
  if (meeting.meeting_type !== 'regular') return false

  // 일괄 환불 부분 실패로 `deleting`에 멈춘 모임의 confirmed 잔재까지 거른다
  if (meeting.status !== 'active') return false

  // 모임일 경과 — 당일은 아직 미경과(다음날 0시 KST부터). 선결제만으로 자격을 주면
  // 정기 하나를 결제하는 그 자리에서 토론까지 신청할 수 있어 게이트가 무력화된다
  return getDaysUntil(meeting.date, kstToday) < 0
}

/** 정기모임 실참여가 1건이라도 있는가 (윈도우 없음 — 평생) */
export function hasRegularAttendance(rows: AttendanceRow[], kstToday: string): boolean {
  return rows.some((row) => countsAsRegularAttendance(row, kstToday))
}

/** 자격 판정에 필요한 사람 쪽 정보 */
export type EligibilityViewer = {
  /** admin · editor · is_staff — 발제 권한(isCurator)과 같은 집합. 갈라놓지 말 것 */
  isCurator: boolean
  /** 정기모임 실참여 1건 이상 */
  hasRegularAttendance: boolean
}

/**
 * 🔴 **단일 진입점.** 모임 유형을 인자로 받아 함수 안에서 갈라준다 —
 * `calculateRefundByType`(lib/refund.ts)과 같은 모양이다.
 * 호출부가 `meeting_type === 'discussion' && ...`를 각자 반복하지 않게 하는 것이 목적이고,
 * 그래야 한 곳이 빠져도 드러난다(A-1 환불 미배선 사고의 재발 방지).
 *
 * 정기모임·그 외 유형은 자격 제한이 없으므로 항상 true.
 */
export function canApplyToMeeting(
  meetingType: string | null | undefined,
  viewer: EligibilityViewer,
): boolean {
  if (meetingType !== 'discussion') return true
  return viewer.isCurator || viewer.hasRegularAttendance
}
