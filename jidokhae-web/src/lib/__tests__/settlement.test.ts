/**
 * 정산 헬퍼 단위 테스트
 * 순수 함수 3종: elapsedDaysKST, formatKSTDateTime, sortDepositRows
 * (쿼리 헬퍼 getPendingDeposits / getPendingRefunds 는 Supabase 의존 → 단위 테스트 제외)
 */

import { describe, it, expect } from 'vitest'
import {
  elapsedDaysKST,
  formatKSTDateTime,
  sortDepositRows,
  type DepositRow,
} from '@/lib/settlement'

// ─── elapsedDaysKST ───

describe('elapsedDaysKST', () => {
  it('당일 신청 → 0', () => {
    // KST 2026-07-04 12:00 = UTC 2026-07-04T03:00:00Z
    const result = elapsedDaysKST('2026-07-04T03:00:00Z', '2026-07-04')
    expect(result).toBe(0)
  })

  it('3일 전 신청 → 3', () => {
    // KST 2026-07-01 = UTC 2026-07-01T00:00:00+09:00 → UTC 2026-06-30T15:00:00Z
    const result = elapsedDaysKST('2026-06-30T15:00:00Z', '2026-07-04')
    expect(result).toBe(3)
  })

  it('KST 자정 경계: UTC 2026-07-03T15:30:00Z = KST 2026-07-04 00:30 → 당일로 계산', () => {
    // UTC 15:30 + 9h = KST 00:30 → KST date = 2026-07-04
    // kstToday = 2026-07-04 이므로 경과일 = 0
    const result = elapsedDaysKST('2026-07-03T15:30:00Z', '2026-07-04')
    expect(result).toBe(0)
  })

  it('UTC 14:59(KST 전날 23:59) 신청 → 1일 경과', () => {
    // UTC 2026-07-03T14:59:00Z = KST 2026-07-03 23:59 → KST date = 2026-07-03
    // kstToday = 2026-07-04 이므로 경과일 = 1
    const result = elapsedDaysKST('2026-07-03T14:59:00Z', '2026-07-04')
    expect(result).toBe(1)
  })
})

// ─── formatKSTDateTime ───

describe('formatKSTDateTime', () => {
  it('오후 케이스: 2026-05-12T06:24:00Z → "5/12 오후 3:24"', () => {
    // UTC 06:24 + 9h = KST 15:24
    expect(formatKSTDateTime('2026-05-12T06:24:00Z')).toBe('5/12 오후 3:24')
  })

  it('오전 케이스: 2026-05-08T00:10:00Z → "5/8 오전 9:10"', () => {
    // UTC 00:10 + 9h = KST 09:10
    expect(formatKSTDateTime('2026-05-08T00:10:00Z')).toBe('5/8 오전 9:10')
  })

  it('자정(KST 00:00) → "오전 12:xx" (hour 0 → 12)', () => {
    // UTC 2026-06-01T15:05:00Z + 9h = KST 00:05
    expect(formatKSTDateTime('2026-06-01T15:05:00Z')).toBe('6/2 오전 12:05')
  })

  it('정오(KST 12:00) → "오후 12:00"', () => {
    // UTC 2026-06-15T03:00:00Z + 9h = KST 12:00
    expect(formatKSTDateTime('2026-06-15T03:00:00Z')).toBe('6/15 오후 12:00')
  })

  it('분이 한 자리인 경우 0 패딩: KST 14:05 → "오후 2:05"', () => {
    // UTC 2026-07-10T05:05:00Z + 9h = KST 14:05
    expect(formatKSTDateTime('2026-07-10T05:05:00Z')).toBe('7/10 오후 2:05')
  })
})

// ─── sortDepositRows ───

/** 테스트용 DepositRow 생성 헬퍼 */
function makeRow(overrides: Partial<DepositRow> & { id: string }): DepositRow {
  return {
    createdAt: '2026-07-01T00:00:00Z',
    paidAmount: 10000,
    meetingTitle: '테스트 모임',
    meetingDate: '2026-07-15',
    nickname: '테스트',
    realName: null,
    phone: null,
    elapsedDays: 0,
    isStaffDiscount: false,
    ...overrides,
  }
}

describe('sortDepositRows', () => {
  const rows: DepositRow[] = [
    makeRow({ id: 'c', createdAt: '2026-07-03T00:00:00Z', paidAmount: 15000, meetingDate: '2026-07-20' }),
    makeRow({ id: 'a', createdAt: '2026-07-01T00:00:00Z', paidAmount: 5000,  meetingDate: '2026-07-10' }),
    makeRow({ id: 'b', createdAt: '2026-07-02T00:00:00Z', paidAmount: 10000, meetingDate: '2026-07-15' }),
  ]

  it('created: 오래된 → 최신 순(id: a → b → c)', () => {
    const result = sortDepositRows(rows, 'created')
    expect(result.map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })

  it('amount: 높은 금액 우선(id: c → b → a)', () => {
    const result = sortDepositRows(rows, 'amount')
    expect(result.map((r) => r.id)).toEqual(['c', 'b', 'a'])
  })

  it('meeting: 모임 날짜 오름차순(id: a → b → c)', () => {
    const result = sortDepositRows(rows, 'meeting')
    expect(result.map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })

  it('meeting 정렬 시 동일 meetingDate는 createdAt 오름차순으로 tiebreak', () => {
    const tied: DepositRow[] = [
      makeRow({ id: 'x', createdAt: '2026-07-02T00:00:00Z', meetingDate: '2026-07-15' }),
      makeRow({ id: 'y', createdAt: '2026-07-01T00:00:00Z', meetingDate: '2026-07-15' }),
    ]
    const result = sortDepositRows(tied, 'meeting')
    expect(result.map((r) => r.id)).toEqual(['y', 'x'])
  })

  it('입력 배열을 변경하지 않는다 (immutable)', () => {
    const original = [...rows]
    sortDepositRows(rows, 'amount')
    expect(rows.map((r) => r.id)).toEqual(original.map((r) => r.id))
  })

  it('빈 배열 → 빈 배열 반환', () => {
    expect(sortDepositRows([], 'created')).toEqual([])
  })
})
