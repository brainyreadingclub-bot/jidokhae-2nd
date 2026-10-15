import { isCurator } from '@/lib/curator'

/**
 * 발제 답변 **읽기** 자격 (순수 함수 — client 번들 안전).
 *
 * 2026-10-13 대표님 결정: 답변은 사적인 내용(이번 책은 실연·용서)이라
 * **그 모임 신청자(confirmed·pending_transfer) + 운영진(curator)만** 본문·닉네임을 본다.
 * 신청 안 한 회원에게는 발제 질문과 답한 사람 수만 간다 — 화면이 아니라 **서버가 데이터를 안 내려보낸다.**
 *
 * 2026-10-15 대표님 결정 — **응답 후 공개(써야 보인다)**: 신청자는 그 발제에 자기 답을 남겨야
 * 그 발제의 다른 답(답글·공감 포함)을 본다. 운영진과 그 모임 발제자는 그대로 다 본다. 자기 답은 언제나 본다.
 * 켜고 끄는 값은 모임 단위(`meetings.answers_reveal_after_own`) — 비어 있으면 토론모임만 켜짐.
 *
 * - 신청자 기준은 쓰기 자격(`canWriteAnswer`)과 같다. 대기자(waitlisted)·취소자는 못 읽는다
 * - 운영진 = `isCurator` (admin·editor·스텝) — DB `is_curator()`와 같은 기준
 * - DB 규칙(RLS)도 같은 기준이다: supabase/migration-answers-reveal-after-own.sql — **둘이 같아야 한다**
 */
export function canReadAnswers(
  liveRegistration: boolean,
  profile: { role: string; is_staff: boolean | null } | null,
): boolean {
  if (liveRegistration) return true
  return profile ? isCurator(profile) : false
}

/**
 * 이 모임에 「응답 후 공개」가 켜져 있나.
 * 칸이 비어 있으면(또는 SQL 실행 전이라 칸이 없으면) 유형 기본값 — 토론모임만 켜짐.
 * DB `public.answers_reveal_after_own_on()`과 같은 기준.
 */
export function isRevealAfterOwnOn(meeting: {
  meeting_type?: string | null
  answers_reveal_after_own?: boolean | null
}): boolean {
  if (typeof meeting.answers_reveal_after_own === 'boolean') return meeting.answers_reveal_after_own
  return meeting.meeting_type === 'discussion'
}

/** 발제 하나에서 이 회원이 보는 상태 */
export type TopicAnswerView =
  /** 운영진·발제자 — 다 본다 */
  | 'staff'
  /** 신청자, 이미 답했거나 응답 후 공개가 꺼진 모임 — 다 본다 */
  | 'open'
  /** 신청자, 아직 안 씀 — 자기 답만, 남의 답은 숫자만 */
  | 'locked'
  /** 미신청·대기·취소·비로그인 — 숫자만 (자기 옛 답은 본다) */
  | 'outsider'

export function topicAnswerView(input: {
  /** 그 모임에 confirmed·pending_transfer 행이 있다 */
  live: boolean
  /** 그 모임의 발제자다 (confirmed 발제자 행) */
  presenter: boolean
  /** admin·editor·스텝 */
  curator: boolean
  /** 이 모임에 응답 후 공개가 켜져 있다 */
  revealAfterOwn: boolean
  /** 이 발제에 자기 답이 하나라도 있다 */
  answeredHere: boolean
}): TopicAnswerView {
  if (input.curator || input.presenter) return 'staff'
  if (!input.live) return 'outsider'
  if (!input.revealAfterOwn || input.answeredHere) return 'open'
  return 'locked'
}

/** 남의 답(본문·닉네임·답글·공감)을 내려보내도 되는 상태인가 */
export function canSeeOthersAnswers(view: TopicAnswerView): boolean {
  return view === 'staff' || view === 'open'
}

/** 미신청자 안내 칸의 버튼 자리 — 신청 가능하면 버튼, 아니면 그 상태를 말한다 */
export type TopicApplyCta = 'apply' | 'closed' | 'full' | 'waitlisted'

export function topicApplyCta(input: {
  waitlisted: boolean
  applyOpen: boolean
  meetingActive: boolean
  confirmedCount: number
  capacity: number
}): TopicApplyCta {
  if (input.waitlisted) return 'waitlisted'
  if (!input.meetingActive || !input.applyOpen) return 'closed'
  if (input.confirmedCount >= input.capacity) return 'full'
  return 'apply'
}
