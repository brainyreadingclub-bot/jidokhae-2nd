/**
 * 발제자 링크 규칙 (순수 함수, 2026-10-10 2차 — 대표님 확정).
 * 토론모임마다 링크 하나. 받은 사람은 로그인 없이 발제를 쓰고, 쓴 글은 「작성 중」으로만 들어간다.
 * 공개는 운영자만 한다(공개되면 1차의 10분 묶음 알림이 그대로 간다).
 *
 * 🔴 닫히는 시각은 저장하지 않는다 — 매번 「모임 날짜 다음날 0시(한국시간)」로 계산한다.
 *    모임 날짜를 바꾸면 닫히는 시각도 저절로 따라간다. 모임이 삭제·취소되면 바로 닫힌다.
 */

import { formatMonthDay, shiftDate } from '@/lib/kst'

/** 링크 하나로 받을 수 있는 발제 수 — 닿으면 「운영자에게 말해 주세요」 */
export const PRESENTER_TOPIC_CAP = 30
/** 남용 방지 — 한 모임에 링크로 1분 동안 넣을 수 있는 발제 수 */
export const PRESENTER_RATE_PER_MINUTE = 5

const TOKEN_RE = /^[A-Za-z0-9_-]{32}$/
const DEVICE_RE = /^[A-Za-z0-9_-]{22,64}$/

/** 주소에 들어가는 토큰 모양 검사 — 모양이 틀리면 DB를 묻지도 않는다 */
export function isValidToken(token: string): boolean {
  return TOKEN_RE.test(token)
}

/** 기기 표시(브라우저가 기억하는 무작위 값) 모양 검사 */
export function isValidDeviceId(device: unknown): device is string {
  return typeof device === 'string' && DEVICE_RE.test(device)
}

export type LinkState = {
  closed_at: string | null
}

export type LinkMeeting = {
  date: string // YYYY-MM-DD
  status: string
  meeting_type: string | null
}

/**
 * 링크가 열려 있나. 닫히는 경우는 넷 —
 * 운영자가 닫음(closed_at) · 모임이 active가 아님(삭제·삭제 중) · 토론모임이 아님 · 모임 다음날 0시(KST)가 지남
 */
export function isLinkOpen(
  link: LinkState | null,
  meeting: LinkMeeting | null,
  kstToday: string,
): boolean {
  if (!link || !meeting) return false
  if (link.closed_at !== null) return false
  if (meeting.status !== 'active') return false
  if (meeting.meeting_type !== 'discussion') return false
  // 날짜 문자열(YYYY-MM-DD) 비교 — 모임 당일까지 열리고 다음날 0시에 닫힌다
  return kstToday <= meeting.date
}

/** 「10월 28일 0시」 — 모임 날짜 다음날 */
export function linkClosesAtLabel(meetingDate: string): string {
  return `${formatMonthDay(shiftDate(meetingDate, 1))} 0시`
}
