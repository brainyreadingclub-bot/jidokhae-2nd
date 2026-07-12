import { describe, it, expect } from 'vitest'
import { isAskEligibleMeeting, askSourceLabel, ASK_WINDOW_DAYS } from '@/lib/asks'

const today = '2026-07-12'

describe('isAskEligibleMeeting', () => {
  it('정기 + active + 어제 모임은 대상', () => {
    expect(
      isAskEligibleMeeting({ date: '2026-07-11', meeting_type: 'regular', status: 'active' }, today),
    ).toBe(true)
  })

  it('토론모임은 제외', () => {
    expect(
      isAskEligibleMeeting({ date: '2026-07-11', meeting_type: 'discussion', status: 'active' }, today),
    ).toBe(false)
  })

  it('미래 모임(오늘 포함)은 제외', () => {
    expect(
      isAskEligibleMeeting({ date: today, meeting_type: 'regular', status: 'active' }, today),
    ).toBe(false)
    expect(
      isAskEligibleMeeting({ date: '2026-07-20', meeting_type: 'regular', status: 'active' }, today),
    ).toBe(false)
  })

  it('active 아닌 모임(deleted 등)은 제외', () => {
    expect(
      isAskEligibleMeeting({ date: '2026-07-11', meeting_type: 'regular', status: 'deleted' }, today),
    ).toBe(false)
  })

  it('윈도우 밖(60일 초과 과거)은 제외', () => {
    // 61일 전
    expect(
      isAskEligibleMeeting({ date: '2026-05-12', meeting_type: 'regular', status: 'active' }, today),
    ).toBe(false)
  })

  it('윈도우 경계(정확히 60일 전)는 대상', () => {
    // 2026-07-12 - 60일 = 2026-05-13
    expect(
      isAskEligibleMeeting({ date: '2026-05-13', meeting_type: 'regular', status: 'active' }, today),
    ).toBe(true)
  })
})

describe('askSourceLabel', () => {
  it('날짜에서 N월 라벨을 만든다', () => {
    expect(askSourceLabel('2026-07-11')).toBe('7월 정기모임에서')
    expect(askSourceLabel('2026-12-01')).toBe('12월 정기모임에서')
  })

  it('null이면 null', () => {
    expect(askSourceLabel(null)).toBeNull()
    expect(askSourceLabel(undefined)).toBeNull()
  })
})

describe('ASK_WINDOW_DAYS', () => {
  it('60일', () => {
    expect(ASK_WINDOW_DAYS).toBe(60)
  })
})
