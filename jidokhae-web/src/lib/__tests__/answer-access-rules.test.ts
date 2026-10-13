import { describe, it, expect } from 'vitest'
import { canReadAnswers, topicApplyCta } from '@/lib/answer-access-rules'

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
