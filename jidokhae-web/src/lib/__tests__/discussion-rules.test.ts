/**
 * 토론모임 규칙 단위 테스트
 * 2026-08-17 확정: 신청 마감 = D-7 = 환불 100% 경계 = 책 주문 마감 (날짜 단위)
 */

import { describe, it, expect } from 'vitest'
import {
  isDiscussionApplyOpen,
  canWriteAnswer,
  DISCUSSION_APPLY_CLOSE_DAYS,
} from '@/lib/discussion-rules'

describe('isDiscussionApplyOpen — D-7 마감 (날짜 단위)', () => {
  const MEETING = '2026-09-13'

  it('D-8 → 열림', () => {
    expect(isDiscussionApplyOpen(MEETING, '2026-09-05')).toBe(true)
  })
  it('D-7 당일 → 열림 (그날 23:59까지, 날짜 단위라 하루 내내 true)', () => {
    expect(isDiscussionApplyOpen(MEETING, '2026-09-06')).toBe(true)
  })
  it('D-6 → 마감', () => {
    expect(isDiscussionApplyOpen(MEETING, '2026-09-07')).toBe(false)
  })
  it('당일 → 마감', () => {
    expect(isDiscussionApplyOpen(MEETING, '2026-09-13')).toBe(false)
  })
  it('상수는 7', () => {
    expect(DISCUSSION_APPLY_CLOSE_DAYS).toBe(7)
  })
})

describe('canWriteAnswer — 신청자만 쓴다 (pending_transfer 동등)', () => {
  it('confirmed → true', () => expect(canWriteAnswer('confirmed')).toBe(true))
  it('pending_transfer → true (입금 확인 지연 시 동등 취급 원칙)', () =>
    expect(canWriteAnswer('pending_transfer')).toBe(true))
  it('waitlisted → false', () => expect(canWriteAnswer('waitlisted')).toBe(false))
  it('cancelled → false', () => expect(canWriteAnswer('cancelled')).toBe(false))
  it('null(미신청) → false', () => expect(canWriteAnswer(null)).toBe(false))
})
