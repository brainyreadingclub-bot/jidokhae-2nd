/**
 * 토론모임 규칙 단위 테스트
 * 2026-10-13 대표님 결정: D-7 신청 마감 폐지 — 정기모임처럼 정원까지 받고, 차면 대기.
 * (옛 결정 2026-08-17 "신청 마감 = D-7"을 대체)
 */

import { describe, it, expect } from 'vitest'
import { isDiscussionApplyOpen, canWriteAnswer } from '@/lib/discussion-rules'
import { getButtonState } from '@/lib/kst'

const MEETING = '2026-11-29'

describe('isDiscussionApplyOpen — 마감 없음, 정기모임과 같은 경계(당일까지 열림)', () => {
  it('D-30 → 열림', () => expect(isDiscussionApplyOpen(MEETING, '2026-10-30')).toBe(true))
  it('D-7 → 열림', () => expect(isDiscussionApplyOpen(MEETING, '2026-11-22')).toBe(true))
  it('D-6 → 열림 (옛 D-7 마감이면 닫혔다)', () =>
    expect(isDiscussionApplyOpen(MEETING, '2026-11-23')).toBe(true))
  it('D-1 → 열림', () => expect(isDiscussionApplyOpen(MEETING, '2026-11-28')).toBe(true))
  it('당일 → 열림', () => expect(isDiscussionApplyOpen(MEETING, '2026-11-29')).toBe(true))
  it('다음날(지난 모임) → 닫힘', () =>
    expect(isDiscussionApplyOpen(MEETING, '2026-11-30')).toBe(false))
})

/**
 * 모임 상세 버튼은 토론모임도 `getButtonState`를 그대로 쓴다 (meeting-detail.ts — D-7 덮어쓰기 제거).
 * 토론 전용으로 남은 관문은 참여 자격·격리 플래그(discussion-gate, DB 조회라 여기서는 안 다룬다).
 */
describe('신청 마감 폐지 — 토론모임 상세 버튼 상태 (getButtonState)', () => {
  it('D-6 · 정원 전 → 신청', () =>
    expect(getButtonState(MEETING, '2026-11-23', false, false)).toEqual({ type: 'register' }))
  it('D-1 · 정원 전 → 신청', () =>
    expect(getButtonState(MEETING, '2026-11-28', false, false)).toEqual({ type: 'register' }))
  it('당일 · 정원 전 → 신청', () =>
    expect(getButtonState(MEETING, '2026-11-29', false, false)).toEqual({ type: 'register' }))
  it('D-1 · 정원 참 → 대기 신청', () =>
    expect(getButtonState(MEETING, '2026-11-28', false, true)).toEqual({ type: 'join_waitlist' }))
  it('지난 모임 · 미신청 → 버튼 없음(닫힘)', () =>
    expect(getButtonState(MEETING, '2026-11-30', false, false)).toEqual({ type: 'none' }))
  it('지난 모임 · 정원 참 → 버튼 없음(닫힘)', () =>
    expect(getButtonState(MEETING, '2026-11-30', false, true)).toEqual({ type: 'none' }))
  it('D-1 · 이미 신청 → 취소 버튼 (신청자 동작은 그대로)', () =>
    expect(getButtonState(MEETING, '2026-11-28', true, true)).toEqual({ type: 'cancel' }))
})

describe('canWriteAnswer — 신청자만 쓴다 (pending_transfer 동등)', () => {
  it('confirmed → true', () => expect(canWriteAnswer('confirmed')).toBe(true))
  it('pending_transfer → true (입금 확인 지연 시 동등 취급 원칙)', () =>
    expect(canWriteAnswer('pending_transfer')).toBe(true))
  it('waitlisted → false', () => expect(canWriteAnswer('waitlisted')).toBe(false))
  it('cancelled → false', () => expect(canWriteAnswer('cancelled')).toBe(false))
  it('null(미신청) → false', () => expect(canWriteAnswer(null)).toBe(false))
})
