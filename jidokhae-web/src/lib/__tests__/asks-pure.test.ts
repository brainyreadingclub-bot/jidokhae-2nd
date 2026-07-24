import { describe, it, expect } from 'vitest'
import { computeAskStats } from '@/lib/asks-pure'
import type { AskStatsRegRow, AskStatsAskRow } from '@/lib/asks-pure'

// 기준일: 2026-07-20. 60일 윈도우 → 2026-05-21 이후 과거 정기모임만 자격.
const TODAY = '2026-07-20'

function reg(userId: string, meetingId: string, date: string, opts?: { type?: string; status?: string }): AskStatsRegRow {
  return {
    user_id: userId,
    meeting_id: meetingId,
    meetings: { date, meeting_type: opts?.type ?? 'regular', status: opts?.status ?? 'active' },
  }
}

function ask(userId: string, meetingId: string, status: string): AskStatsAskRow {
  return { user_id: userId, meeting_id: meetingId, status }
}

describe('computeAskStats', () => {
  it('빈 입력이면 모든 값 0', () => {
    const s = computeAskStats([], [], TODAY)
    expect(s).toEqual({
      denominator: 0,
      exposed: 0,
      answered: 0,
      dismissed: 0,
      viewed: 0,
      unexposed: 0,
      exposureRate: 0,
      conversionRate: 0,
    })
  })

  it('자격 참여만 분모에 셈 (미래/비정기/비active/윈도우 밖 제외)', () => {
    const regs = [
      reg('u1', 'm1', '2026-07-10'), // 자격 (10일 전)
      reg('u2', 'm2', '2026-08-01'), // 미래 → 제외
      reg('u3', 'm3', '2026-07-01', { type: 'special' }), // 비정기 → 제외
      reg('u4', 'm4', '2026-07-01', { status: 'deleted' }), // 비active → 제외
      reg('u5', 'm5', '2026-01-01'), // 윈도우 밖(60일 초과) → 제외
    ]
    const s = computeAskStats(regs, [], TODAY)
    expect(s.denominator).toBe(1)
  })

  it('같은 (user,meeting) 중복 참여는 분모에서 dedup', () => {
    const regs = [reg('u1', 'm1', '2026-07-10'), reg('u1', 'm1', '2026-07-10')]
    const s = computeAskStats(regs, [], TODAY)
    expect(s.denominator).toBe(1)
  })

  it('[회귀] 분자는 자격 모수와 교집합 — 윈도우 밖 answered는 응답률 100% 초과를 만들지 않는다', () => {
    // 자격 참여 1건(m1). book_asks에는 자격 밖(m_old, 윈도우 초과) answered가 섞여 있음.
    const regs = [reg('u1', 'm1', '2026-07-10')]
    const asks = [
      ask('u1', 'm1', 'viewed'), // 자격 O, 노출됨 미응답
      ask('u9', 'm_old', 'answered'), // 자격 X (분모에 없는 모임) → 제외돼야 함
      ask('u9', 'm_old', 'dismissed'), // 자격 X → 제외
    ]
    const s = computeAskStats(regs, asks, TODAY)
    expect(s.denominator).toBe(1)
    expect(s.answered).toBe(0) // 교집합으로 제외
    expect(s.dismissed).toBe(0)
    expect(s.viewed).toBe(1)
    expect(s.exposed).toBe(1)
    expect(s.exposureRate).toBe(100)
    expect(s.conversionRate).toBe(0)
    expect(s.conversionRate).toBeLessThanOrEqual(100)
  })

  it('전환율 = 담음 / 노출 (분모가 실제 노출이어야 함)', () => {
    // 자격 참여 4건, 그 중 3건 노출(answered 1, dismissed 1, viewed 1), 1건 미노출
    const regs = [
      reg('u1', 'm1', '2026-07-10'),
      reg('u2', 'm1', '2026-07-10'),
      reg('u3', 'm1', '2026-07-10'),
      reg('u4', 'm1', '2026-07-10'),
    ]
    const asks = [
      ask('u1', 'm1', 'answered'),
      ask('u2', 'm1', 'dismissed'),
      ask('u3', 'm1', 'viewed'),
    ]
    const s = computeAskStats(regs, asks, TODAY)
    expect(s.denominator).toBe(4)
    expect(s.exposed).toBe(3)
    expect(s.unexposed).toBe(1)
    expect(s.answered).toBe(1)
    expect(s.exposureRate).toBe(75) // 3/4
    expect(s.conversionRate).toBe(33) // 1/3 반올림
  })

  it('노출이 0이면 전환율 0 (0 나눗셈 방지)', () => {
    const regs = [reg('u1', 'm1', '2026-07-10')]
    const s = computeAskStats(regs, [], TODAY)
    expect(s.exposed).toBe(0)
    expect(s.conversionRate).toBe(0)
    expect(s.exposureRate).toBe(0)
  })
})
