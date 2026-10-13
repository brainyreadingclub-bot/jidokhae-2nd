/**
 * 결제 **전** 환불 안내가 쓰는 순수 함수 테스트.
 *
 * 왜 이 테스트가 있나 — 화면에 "9월 6일까지 전액"이라고 손으로 적으면
 * 규칙(토론 14/7, 정기 3/2)이 바뀔 때 문구만 남는다. 그래서 규칙 상수에서 계산하게 만들었고,
 * 이 테스트가 "규칙과 문구가 같은 곳에서 나온다"를 고정한다.
 */

import { describe, it, expect } from 'vitest'
import {
  getRefundScheduleByType,
  REFUND_RULES,
  DISCUSSION_REFUND_RULES,
} from '@/lib/refund'
import { shiftDate, formatMonthDay } from '@/lib/kst'

describe('shiftDate', () => {
  it('음수로 이동한다', () => {
    expect(shiftDate('2026-09-13', -7)).toBe('2026-09-06')
  })

  it('월 경계를 넘는다', () => {
    expect(shiftDate('2026-09-02', -3)).toBe('2026-08-30')
  })

  it('연 경계를 넘는다', () => {
    expect(shiftDate('2027-01-02', -3)).toBe('2026-12-30')
  })

  it('윤년 2월을 넘는다', () => {
    expect(shiftDate('2028-03-01', -1)).toBe('2028-02-29')
  })
})

describe('formatMonthDay', () => {
  it('요일 없이 "9월 6일"', () => {
    expect(formatMonthDay('2026-09-06')).toBe('9월 6일')
  })

  it('앞의 0을 떼고 읽는다', () => {
    expect(formatMonthDay('2026-01-05')).toBe('1월 5일')
  })
})

describe('getRefundScheduleByType', () => {
  it('정기모임 — 3일 100% / 2일 50%', () => {
    const s = getRefundScheduleByType('regular', '2026-09-13')
    expect(s).toEqual([
      { rate: 100, daysBefore: 3, date: '2026-09-10' },
      { rate: 50, daysBefore: 2, date: '2026-09-11' },
    ])
  })

  it('meeting_type이 null이면 정기 규칙으로 폴백한다 (구 데이터)', () => {
    expect(getRefundScheduleByType(null, '2026-09-13')).toEqual(
      getRefundScheduleByType('regular', '2026-09-13'),
    )
  })

  it('토론모임 — 14일 100% / 7일 50% (2026-10-13 결정)', () => {
    const s = getRefundScheduleByType('discussion', '2026-09-13')
    expect(s).toEqual([
      { rate: 100, daysBefore: 14, date: '2026-08-30' },
      { rate: 50, daysBefore: 7, date: '2026-09-06' },
    ])
  })

  it('규칙 상수를 그대로 읽는다 — 화면에 비율을 손으로 적지 않는다', () => {
    expect(getRefundScheduleByType('regular', '2026-09-13').map((s) => s.rate)).toEqual(
      REFUND_RULES.map((r) => r.rate),
    )
    expect(getRefundScheduleByType('discussion', '2026-09-13').map((s) => s.rate)).toEqual(
      DISCUSSION_REFUND_RULES.map((r) => r.rate),
    )
  })
})
