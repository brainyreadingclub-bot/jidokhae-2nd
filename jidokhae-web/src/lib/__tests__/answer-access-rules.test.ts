import { describe, it, expect } from 'vitest'
import {
  canReadAnswers,
  canSeeOthersAnswers,
  isRevealAfterOwnOn,
  topicAnswerView,
  topicApplyCta,
} from '@/lib/answer-access-rules'

const member = { role: 'member', is_staff: false }

describe('canReadAnswers — 신청자 + 운영진만', () => {
  it('신청자(confirmed·pending_transfer 행이 있음)는 읽는다', () => {
    expect(canReadAnswers(true, member)).toBe(true)
  })
  it('신청 안 한 일반 회원은 못 읽는다', () => {
    expect(canReadAnswers(false, member)).toBe(false)
  })
  it('로그인 안 했으면 못 읽는다', () => {
    expect(canReadAnswers(false, null)).toBe(false)
  })
  it.each(['admin', 'editor'])('%s는 신청 없이도 읽는다', (role) => {
    expect(canReadAnswers(false, { role, is_staff: false })).toBe(true)
  })
  it('스텝(is_staff)은 신청 없이도 읽는다 — DB is_curator()와 같은 기준', () => {
    expect(canReadAnswers(false, { role: 'member', is_staff: true })).toBe(true)
  })
})

describe('topicApplyCta — 미신청자 안내 칸의 버튼 자리', () => {
  const base = { waitlisted: false, applyOpen: true, meetingActive: true, confirmedCount: 3, capacity: 10 }
  it('열려 있고 자리가 있으면 신청 버튼', () => {
    expect(topicApplyCta(base)).toBe('apply')
  })
  it('정원이 차면 마감 표시', () => {
    expect(topicApplyCta({ ...base, confirmedCount: 10 })).toBe('full')
  })
  it('신청 기간이 닫히면 closed', () => {
    expect(topicApplyCta({ ...base, applyOpen: false })).toBe('closed')
  })
  it('모임이 active가 아니면 closed', () => {
    expect(topicApplyCta({ ...base, meetingActive: false })).toBe('closed')
  })
  it('대기 중이면 버튼 대신 대기 안내 (정원·기간보다 먼저)', () => {
    expect(topicApplyCta({ ...base, waitlisted: true, confirmedCount: 10 })).toBe('waitlisted')
  })
})

describe('isRevealAfterOwnOn — 응답 후 공개 켜짐 여부 (모임 단위)', () => {
  it('칸이 비어 있으면 토론모임은 켜짐', () => {
    expect(isRevealAfterOwnOn({ meeting_type: 'discussion', answers_reveal_after_own: null })).toBe(true)
  })
  it('칸이 비어 있으면 정기모임은 꺼짐', () => {
    expect(isRevealAfterOwnOn({ meeting_type: 'regular', answers_reveal_after_own: null })).toBe(false)
  })
  it('SQL 실행 전이라 칸 자체가 없어도 유형 기본값을 따른다', () => {
    expect(isRevealAfterOwnOn({ meeting_type: 'discussion' })).toBe(true)
  })
  it('모임에 값을 적으면 유형보다 그 값이 이긴다', () => {
    expect(isRevealAfterOwnOn({ meeting_type: 'discussion', answers_reveal_after_own: false })).toBe(false)
    expect(isRevealAfterOwnOn({ meeting_type: 'regular', answers_reveal_after_own: true })).toBe(true)
  })
})

describe('topicAnswerView — 발제 하나에서 남의 답을 보나 (2026-10-15 응답 후 공개)', () => {
  const applicant = { live: true, presenter: false, curator: false, revealAfterOwn: true, answeredHere: false }

  it('신청자가 아직 안 쓴 발제는 잠긴다', () => {
    expect(topicAnswerView(applicant)).toBe('locked')
    expect(canSeeOthersAnswers('locked')).toBe(false)
  })
  it('신청자가 답을 남긴 발제는 열린다', () => {
    expect(topicAnswerView({ ...applicant, answeredHere: true })).toBe('open')
    expect(canSeeOthersAnswers('open')).toBe(true)
  })
  it('응답 후 공개가 꺼진 모임이면 신청자는 쓰지 않아도 본다', () => {
    expect(topicAnswerView({ ...applicant, revealAfterOwn: false })).toBe('open')
  })
  it('운영진은 쓰지 않아도, 신청하지 않아도 다 본다', () => {
    expect(topicAnswerView({ ...applicant, live: false, curator: true })).toBe('staff')
    expect(canSeeOthersAnswers('staff')).toBe(true)
  })
  it('그 모임 발제자는 쓰지 않아도 다 본다', () => {
    expect(topicAnswerView({ ...applicant, presenter: true })).toBe('staff')
  })
  it('미신청·대기·취소한 회원은 다른 발제에 답이 있어도 못 본다', () => {
    expect(topicAnswerView({ ...applicant, live: false, answeredHere: true })).toBe('outsider')
    expect(canSeeOthersAnswers('outsider')).toBe(false)
  })
})
