import { isCurator } from '@/lib/curator'

/**
 * 발제 답변 **읽기** 자격 (순수 함수 — client 번들 안전).
 *
 * 2026-10-13 대표님 결정: 답변은 사적인 내용(이번 책은 실연·용서)이라
 * **그 모임 신청자(confirmed·pending_transfer) + 운영진(curator)만** 본문·닉네임을 본다.
 * 신청 안 한 회원에게는 발제 질문과 답변 수만 간다 — 화면이 아니라 **서버가 데이터를 안 내려보낸다.**
 *
 * - 신청자 기준은 쓰기 자격(`canWriteAnswer`)과 같다. 대기자(waitlisted)·취소자는 못 읽는다
 * - 운영진 = `isCurator` (admin·editor·스텝) — DB `is_curator()`와 같은 기준
 * - DB 규칙(RLS)도 같은 기준으로 좁힌다: supabase/migration-answers-private.sql
 */
export function canReadAnswers(
  liveRegistration: boolean,
  profile: { role: string; is_staff: boolean | null } | null,
): boolean {
  if (liveRegistration) return true
  return profile ? isCurator(profile) : false
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
