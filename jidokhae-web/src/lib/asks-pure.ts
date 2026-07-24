import { getDaysUntil } from '@/lib/kst'
import type { AskStats } from '@/types/ask'

/** 물어보기 대상 모임의 최근 윈도우(일). 과거 소급 스팸 방지 — "앞으로의 정기모임만"의 실용 근사 */
export const ASK_WINDOW_DAYS = 60

type EligibleMeetingShape = {
  date: string
  meeting_type: string
  status: string
}

/**
 * 물어보기(및 분모) 대상 정기모임인지 순수 판정.
 * 정기 + active + 과거 + 최근 windowDays 이내.
 */
export function isAskEligibleMeeting(
  meeting: EligibleMeetingShape,
  kstToday: string,
  windowDays = ASK_WINDOW_DAYS,
): boolean {
  if (meeting.meeting_type !== 'regular') return false
  if (meeting.status !== 'active') return false
  const days = getDaysUntil(meeting.date, kstToday) // 과거면 음수
  return days < 0 && days >= -windowDays
}

/** "2026-07-11" → "7월 정기모임에서". null/빈 값은 null */
export function askSourceLabel(date: string | null | undefined): string | null {
  if (!date) return null
  const month = Number(date.slice(5, 7))
  if (!month) return null
  return `${month}월 정기모임에서`
}

// computeAskStats 입력 shape (service_role 조회 결과를 순수 함수에 넘기기 위한 최소 형태)
export type AskStatsRegRow = {
  meeting_id: string
  user_id: string
  meetings: { date: string; meeting_type: string; status: string } | null
}
export type AskStatsAskRow = {
  user_id: string
  meeting_id: string
  status: string
}

/**
 * 물어보기 응답률 집계 (순수 함수 — DB 조회 결과를 받아 계산만, 단위 테스트 대상).
 *
 * 핵심: 분자(answered/dismissed/viewed)를 분모(자격 참여)와 **교집합**해서 동일 모집단으로 맞춘다.
 * book_asks 전량에서 세면 60일 윈도우 밖·비자격 건이 섞여 응답률이 100%를 넘는 과거 버그가 재발한다.
 *
 * - denominator: 자격 참여(최근 60일 정기 + active, user·meeting dedup) = 노출 가능 모수
 * - exposed: 자격 참여 중 실제 물어보기가 뜬 건(book_asks 존재)
 * - conversionRate(북극성): 담음 / 노출  ← 분모가 '실제 노출'이어야 정직한 전환율
 * - exposureRate: 노출 / 자격 참여
 */
export function computeAskStats(
  regs: AskStatsRegRow[],
  asks: AskStatsAskRow[],
  kstToday: string,
): AskStats {
  // 자격 참여 모수(분모) — (user,meeting) dedup
  const eligibleKeys = new Set<string>()
  for (const r of regs) {
    if (r.meetings && isAskEligibleMeeting(r.meetings, kstToday)) {
      eligibleKeys.add(`${r.user_id}:${r.meeting_id}`)
    }
  }
  const denominator = eligibleKeys.size

  // 분자는 반드시 자격 모수와 교집합 — 윈도우 밖·비자격 book_asks는 제외
  let answered = 0
  let dismissed = 0
  let viewed = 0
  for (const a of asks) {
    if (!eligibleKeys.has(`${a.user_id}:${a.meeting_id}`)) continue
    if (a.status === 'answered') answered += 1
    else if (a.status === 'dismissed') dismissed += 1
    else if (a.status === 'viewed') viewed += 1
  }

  const exposed = answered + dismissed + viewed
  const unexposed = Math.max(0, denominator - exposed)
  const exposureRate = denominator === 0 ? 0 : Math.round((exposed / denominator) * 100)
  const conversionRate = exposed === 0 ? 0 : Math.round((answered / exposed) * 100)

  return { denominator, exposed, answered, dismissed, viewed, unexposed, exposureRate, conversionRate }
}
