/**
 * processPaymentConfirmation — `already_registered` 분기 회귀 테스트.
 *
 * 🔴 왜 이 파일이 있는가 (2026-10-06 사고 · 실피해 6명 · 72,000)
 *   브라우저가 `/api/registrations/confirm`을 **두 번** 보내면(카카오톡 인앱 브라우저
 *   복귀 시 재마운트) Layer 1 멱등성 체크는 락 밖이라 두 요청이 모두 통과하고,
 *   RPC의 FOR UPDATE가 둘을 줄 세워 **두 번째가 `already_registered`**가 된다.
 *   그때 무조건 환불하면 **방금 자기가 만든 신청의 돈**이 나가고 신청 행은 남는다.
 *   조사: docs/agent-team/조사/2026-10-06-중복환불-사고.md
 *
 *   아래 "동시 호출" 테스트가 깨지면 그 사고가 되돌아온 것이다. 지우지 말 것.
 *   동시에 **진짜 중복은 여전히 환불된다**는 것도 같이 고정한다 — 조건을 단 것이지
 *   환불을 없앤 게 아니다.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// vi.mock 팩토리는 import보다 먼저 평가되므로 vi.hoisted로 핸들을 먼저 만든다.
const mocks = vi.hoisted(() => ({
  getPayment: vi.fn(),
  cancelPayment: vi.fn(),
  createServiceClient: vi.fn(),
}))

vi.mock('@/lib/portone', () => ({
  getPayment: mocks.getPayment,
  cancelPayment: mocks.cancelPayment,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createServiceClient: mocks.createServiceClient,
}))

import { processPaymentConfirmation } from '@/lib/payment'

// ─── 테스트 픽스처 ───

const MEETING_ID = '11111111-1111-4111-8111-111111111111'
const USER_ID = '22222222-2222-4222-8222-222222222222'
// paymentId 형식: jdkh-{meetingId8}-{userId8}-{timestamp}
const PAYMENT_ID = `jdkh-11111111-22222222-1700000000000`
const OTHER_PAYMENT_ID = `jdkh-11111111-22222222-1699999999999`
const FEE = 12000

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

type Row = Record<string, unknown>
type Filter =
  | { kind: 'eq'; col: string; val: unknown }
  | { kind: 'in'; col: string; vals: unknown[] }
type QueryError = { message: string } | null
type QueryResult = { data: Row[] | null; error: QueryError }

type FakeQuery = {
  select: (columns?: string) => FakeQuery
  eq: (col: string, val: unknown) => FakeQuery
  in: (col: string, vals: unknown[]) => FakeQuery
  limit: (n: number) => FakeQuery
  single: () => Promise<{ data: Row | null; error: QueryError }>
  then: <T>(onFulfilled: (v: QueryResult) => T, onRejected?: (e: unknown) => T) => Promise<T>
}

/**
 * 최소 Supabase 대역.
 * - `registrations` / `meetings` 두 표만 가진다
 * - `confirm_registration` RPC의 **중복 판정 + 정원 판정**만 흉내낸다
 *   (스텝 할인 분기는 이 사고와 무관해 생략)
 * - RPC는 뮤텍스로 직렬화해 prod의 `FOR UPDATE`(줄 세우기)를 재현한다
 */
class FakeDb {
  registrations: Row[] = []
  meetings: Row[] = []
  /**
   * `payment_id` 조회의 거동을 앞에서부터 하나씩 소비한다.
   * `blind` = 행이 있는데도 빈 결과(락 밖 멱등성 체크가 아직 못 본 순간)
   * `fail`  = 조회 자체가 실패
   */
  paymentIdReadPlan: Array<'blind' | 'fail'> = []
  /** RPC 결과를 강제한다 (다른 분기 보존 확인용) */
  forcedRpcResult: string | null = null

  private seq = 0
  private lock: Promise<unknown> = Promise.resolve()

  read(table: string, filters: Filter[], limitN: number | null): QueryResult {
    if (table === 'registrations' && filters.some((f) => f.col === 'payment_id')) {
      const plan = this.paymentIdReadPlan.shift()
      if (plan === 'fail') return { data: null, error: { message: 'simulated query failure' } }
      if (plan === 'blind') return { data: [], error: null }
    }

    const source = table === 'registrations' ? this.registrations : this.meetings
    const rows = source.filter((row) =>
      filters.every((f) =>
        f.kind === 'eq' ? row[f.col] === f.val : f.vals.includes(row[f.col]),
      ),
    )
    return { data: limitN === null ? rows : rows.slice(0, limitN), error: null }
  }

  async rpc(name: string, params: Record<string, unknown>) {
    if (name !== 'confirm_registration') throw new Error(`unexpected rpc: ${name}`)
    return this.withLock(() => this.confirmRegistration(params))
  }

  private async withLock<T>(fn: () => T): Promise<T> {
    const prev = this.lock
    let release = () => {}
    this.lock = new Promise<void>((resolve) => {
      release = resolve
    })
    await prev
    // 락 안에서 한 틱 — 다른 요청이 끼어들 틈을 실제로 준다
    await tick()
    try {
      return fn()
    } finally {
      release()
    }
  }

  private confirmRegistration(params: Record<string, unknown>): {
    data: string | null
    error: null
  } {
    if (this.forcedRpcResult) return { data: this.forcedRpcResult, error: null }

    const userId = params.p_user_id
    const meetingId = params.p_meeting_id
    const meeting = this.meetings.find((m) => m.id === meetingId)
    if (!meeting) return { data: 'not_found', error: null }
    if (meeting.status !== 'active') return { data: 'not_active', error: null }

    const duplicate = this.registrations.some(
      (r) =>
        r.user_id === userId &&
        r.meeting_id === meetingId &&
        ['confirmed', 'waitlisted', 'pending_transfer'].includes(String(r.status)),
    )
    if (duplicate) return { data: 'already_registered', error: null }

    const taken = this.registrations.filter(
      (r) =>
        r.meeting_id === meetingId &&
        ['confirmed', 'pending_transfer'].includes(String(r.status)),
    ).length

    const hasRoom = taken < Number(meeting.capacity)
    this.registrations.push({
      id: `reg-${++this.seq}`,
      user_id: userId,
      meeting_id: meetingId,
      status: hasRoom ? 'confirmed' : 'waitlisted',
      payment_id: params.p_payment_id,
      paid_amount: params.p_paid_amount,
    })
    // 실제 RPC 반환값과 동일 — 정원 여석이면 'success', 초과면 'waitlisted'
    return { data: hasRoom ? 'success' : 'waitlisted', error: null }
  }
}

function makeQuery(db: FakeDb, table: string): FakeQuery {
  const filters: Filter[] = []
  let limitN: number | null = null

  const run = async (): Promise<QueryResult> => {
    await tick()
    return db.read(table, filters, limitN)
  }

  const query: FakeQuery = {
    select: () => query,
    eq: (col, val) => {
      filters.push({ kind: 'eq', col, val })
      return query
    },
    in: (col, vals) => {
      filters.push({ kind: 'in', col, vals })
      return query
    },
    limit: (n) => {
      limitN = n
      return query
    },
    single: async () => {
      const result = await run()
      return {
        data: result.data && result.data.length > 0 ? result.data[0] : null,
        error: result.error,
      }
    },
    then: (onFulfilled, onRejected) => run().then(onFulfilled, onRejected),
  }
  return query
}

function makeClient(db: FakeDb) {
  return {
    from: (table: string) => makeQuery(db, table),
    rpc: (name: string, params: Record<string, unknown>) => db.rpc(name, params),
  }
}

let db: FakeDb

beforeEach(() => {
  vi.clearAllMocks()
  db = new FakeDb()
  db.meetings.push({
    id: MEETING_ID,
    fee: FEE,
    status: 'active',
    meeting_type: 'regular',
    capacity: 10,
    date: '2099-12-31',
  })
  mocks.createServiceClient.mockImplementation(() => makeClient(db))
  mocks.getPayment.mockImplementation(async (paymentId: string) => ({
    paymentId,
    transactionId: 'tx',
    status: 'PAID',
    totalAmount: FEE,
    orderName: '테스트 모임',
  }))
  mocks.cancelPayment.mockResolvedValue(undefined)
})

// ─── 1. 동시 호출 (이 사고의 재현) ───

describe('같은 paymentId로 confirm이 두 번 들어올 때', () => {
  it('병렬 호출 — 환불이 나가지 않고 신청 1건만 남는다', async () => {
    const [first, second] = await Promise.all([
      processPaymentConfirmation(PAYMENT_ID, MEETING_ID, USER_ID),
      processPaymentConfirmation(PAYMENT_ID, MEETING_ID, USER_ID),
    ])

    // 🔴 핵심 단언 — 자기 결제를 환불하지 않는다
    expect(mocks.cancelPayment).not.toHaveBeenCalled()

    expect(db.registrations).toHaveLength(1)
    expect(first.status).toBe('success')
    expect(second.status).toBe('success')
    if (first.status === 'success' && second.status === 'success') {
      expect(first.registrationId).toBe(second.registrationId)
      expect(first.registrationId).toBe(String(db.registrations[0].id))
    }
  })

  it('Layer 1이 못 본 뒤 RPC가 already_registered여도 — 내 결제면 환불하지 않는다', async () => {
    // 첫 호출이 이미 만들어 둔 행 (같은 paymentId)
    db.registrations.push({
      id: 'reg-seed',
      user_id: USER_ID,
      meeting_id: MEETING_ID,
      status: 'confirmed',
      payment_id: PAYMENT_ID,
      paid_amount: FEE,
    })
    // 락 밖 멱등성 체크가 그 행을 아직 못 본 상태를 고정
    db.paymentIdReadPlan = ['blind']

    const result = await processPaymentConfirmation(PAYMENT_ID, MEETING_ID, USER_ID)

    expect(mocks.cancelPayment).not.toHaveBeenCalled()
    expect(result).toEqual({ status: 'success', registrationId: 'reg-seed' })
  })

  it('대기 신청으로 만들어진 행이면 waitlisted로 응답하고 환불하지 않는다', async () => {
    db.registrations.push({
      id: 'reg-wait',
      user_id: USER_ID,
      meeting_id: MEETING_ID,
      status: 'waitlisted',
      payment_id: PAYMENT_ID,
      paid_amount: FEE,
    })
    db.paymentIdReadPlan = ['blind']

    const result = await processPaymentConfirmation(PAYMENT_ID, MEETING_ID, USER_ID)

    expect(mocks.cancelPayment).not.toHaveBeenCalled()
    expect(result).toEqual({ status: 'waitlisted', registrationId: 'reg-wait' })
  })
})

// ─── 2. 진짜 중복은 여전히 환불된다 ───

describe('진짜 중복 (다른 결제로 만들어진 신청이 이미 있을 때)', () => {
  it('환불하고 already_registered를 돌려준다', async () => {
    db.registrations.push({
      id: 'reg-old',
      user_id: USER_ID,
      meeting_id: MEETING_ID,
      status: 'confirmed',
      payment_id: OTHER_PAYMENT_ID,
      paid_amount: FEE,
    })

    const result = await processPaymentConfirmation(PAYMENT_ID, MEETING_ID, USER_ID)

    expect(mocks.cancelPayment).toHaveBeenCalledTimes(1)
    expect(mocks.cancelPayment).toHaveBeenCalledWith(PAYMENT_ID, '중복 신청으로 인한 환불')
    expect(result).toEqual({ status: 'already_registered', message: '이미 신청한 모임입니다' })
  })

  it('계좌이체로 이미 신청한(pending_transfer) 뒤 카드로 또 결제하면 환불한다', async () => {
    db.registrations.push({
      id: 'reg-transfer',
      user_id: USER_ID,
      meeting_id: MEETING_ID,
      status: 'pending_transfer',
      payment_method: 'transfer',
      payment_id: null,
      paid_amount: FEE,
    })

    const result = await processPaymentConfirmation(PAYMENT_ID, MEETING_ID, USER_ID)

    expect(mocks.cancelPayment).toHaveBeenCalledWith(PAYMENT_ID, '중복 신청으로 인한 환불')
    expect(result.status).toBe('already_registered')
  })
})

// ─── 3. 재확인 조회가 실패한 경우 ───

describe('already_registered 재확인 조회가 실패하면', () => {
  it('조회 실패를 "대상 없음"과 합치지 않는다 — 환불 보류 + error', async () => {
    db.registrations.push({
      id: 'reg-seed',
      user_id: USER_ID,
      meeting_id: MEETING_ID,
      status: 'confirmed',
      payment_id: PAYMENT_ID,
      paid_amount: FEE,
    })
    // Layer 1은 못 보고(blind), Layer 3 재확인은 조회 실패(fail)
    db.paymentIdReadPlan = ['blind', 'fail']

    const result = await processPaymentConfirmation(PAYMENT_ID, MEETING_ID, USER_ID)

    expect(mocks.cancelPayment).not.toHaveBeenCalled()
    expect(result.status).toBe('error')
  })
})

// ─── 4. 다른 자동환불 분기는 그대로다 ───

describe('다른 RPC 결과는 기존대로 환불한다', () => {
  it('full — 정원 마감 환불 유지', async () => {
    db.forcedRpcResult = 'full'

    const result = await processPaymentConfirmation(PAYMENT_ID, MEETING_ID, USER_ID)

    expect(mocks.cancelPayment).toHaveBeenCalledWith(PAYMENT_ID, '정원 마감으로 인한 환불')
    expect(result.status).toBe('full')
  })

  it('discount_not_eligible — 스텝 할인 자격 없음 환불 유지', async () => {
    db.forcedRpcResult = 'discount_not_eligible'

    const result = await processPaymentConfirmation(PAYMENT_ID, MEETING_ID, USER_ID)

    expect(mocks.cancelPayment).toHaveBeenCalledWith(PAYMENT_ID, '스텝 할인 자격 없음')
    expect(result.status).toBe('error')
  })

  it('staff_slot_full — 슬롯 마감 환불 유지', async () => {
    db.forcedRpcResult = 'staff_slot_full'

    const result = await processPaymentConfirmation(PAYMENT_ID, MEETING_ID, USER_ID)

    expect(mocks.cancelPayment).toHaveBeenCalledWith(PAYMENT_ID, '스텝 할인 슬롯 마감')
    expect(result.status).toBe('error')
  })
})
