/**
 * 정산 헬퍼 단위 테스트
 * 순수 함수 3종: elapsedDaysKST, formatKSTDateTime, sortDepositRows
 * getPendingRefunds는 가짜 Supabase로 「환불할 금액」 계산만 확인한다 (getPendingDeposits는 제외)
 */

import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  elapsedDaysKST,
  formatKSTDateTime,
  sortDepositRows,
  getPendingRefunds,
  type DepositRow,
} from '@/lib/settlement'
import { recommendedTransferRefund } from '@/lib/refund'

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
    meetingId: 'm-test',
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

// ─── getPendingRefunds — 환불할 금액이 「환불 완료」 체크 때 기록되는 값과 같아야 한다 ───
// (종전에는 낸 돈 전액을 보여 줘서, 운영자가 그대로 송금하면 기록과 송금액이 어긋날 수 있었다)


function fakeClient(rows: unknown[]): SupabaseClient {
  const chain: Record<string, unknown> = {}
  for (const m of ['from', 'select', 'eq', 'is', 'gt', 'order']) chain[m] = () => chain
  chain.then = (resolve: (v: unknown) => void) => resolve({ data: rows, error: null })
  return chain as unknown as SupabaseClient
}

const baseRow = {
  id: 'r1',
  paid_amount: 10000,
  profiles: { nickname: '가상회원', real_name: null, phone: null },
}

describe('getPendingRefunds', () => {
  it('정기모임 2일 전 취소 → 환불할 금액 50%, 낸 돈은 전액', async () => {
    const [row] = await getPendingRefunds(
      fakeClient([
        {
          ...baseRow,
          cancel_type: 'user_cancelled',
          // KST 2026-07-08 12:00 취소, 모임 7-10 → 2일 전
          cancelled_at: '2026-07-08T03:00:00Z',
          meetings: { id: 'm1', title: '정기모임', date: '2026-07-10', meeting_type: 'regular' },
        },
      ]),
    )
    expect(row.paidAmount).toBe(10000)
    expect(row.refundAmount).toBe(5000)
  })

  it('토론모임 10일 전 취소 → 14/7 규칙으로 50%', async () => {
    const [row] = await getPendingRefunds(
      fakeClient([
        {
          ...baseRow,
          paid_amount: 25000,
          cancel_type: 'user_cancelled',
          cancelled_at: '2026-07-01T03:00:00Z',
          meetings: { id: 'm2', title: '토론모임', date: '2026-07-11', meeting_type: 'discussion' },
        },
      ]),
    )
    expect(row.refundAmount).toBe(
      recommendedTransferRefund({
        cancelType: 'user_cancelled',
        meetingType: 'discussion',
        meetingDate: '2026-07-11',
        paidAmount: 25000,
        cancelDate: '2026-07-01',
      }),
    )
    expect(row.refundAmount).toBe(12500)
  })

  it('모임 삭제로 닫힌 건 → 날짜와 상관없이 전액', async () => {
    const [row] = await getPendingRefunds(
      fakeClient([
        {
          ...baseRow,
          cancel_type: 'meeting_deleted',
          cancelled_at: '2026-07-10T03:00:00Z',
          meetings: { id: 'm3', title: '정기모임', date: '2026-07-10', meeting_type: 'regular' },
        },
      ]),
    )
    expect(row.refundAmount).toBe(10000)
  })
})
