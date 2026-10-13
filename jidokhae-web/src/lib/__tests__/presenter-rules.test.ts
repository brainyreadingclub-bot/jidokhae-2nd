import { describe, it, expect, vi } from 'vitest'
import {
  isPresenterRow,
  planMoney,
  planSeat,
  meetingBlock,
  runPresenterAssign,
  firstWaitlistedGoesConfirmed,
  sanitizeMemberQuery,
  needsCardRefundDone,
  type PresenterCandidate,
  type AssignDeps,
} from '@/lib/presenter-rules'
import { recommendedTransferRefund, transferCloseRefundedAmount } from '@/lib/refund'

// 설계서 §3-1 표 + 대표님 확정 ⑦. 🔴 이 표는 SQL assign_presenter의 CASE와 같아야 한다
// (SQL 쪽은 supabase/tests/migration-discussion-presenter.pglite.mjs가 같은 갈래를 시험한다)

function cand(over: Partial<PresenterCandidate>): PresenterCandidate {
  return {
    registrationId: 'r1',
    status: 'confirmed',
    paymentMethod: 'card',
    paidAmount: 25000,
    refundedAmount: null,
    hasPaymentId: true,
    ...over,
  }
}

describe('isPresenterRow — SQL 실행 전에도 판정한다', () => {
  it('payment_method none이면 발제자', () => {
    expect(isPresenterRow({ payment_method: 'none' })).toBe(true)
  })
  it('is_presenter 칸이 없어도(undefined) 일반 행은 아니다', () => {
    expect(isPresenterRow({ payment_method: 'card' })).toBe(false)
    expect(isPresenterRow({ payment_method: 'transfer', is_presenter: undefined })).toBe(false)
  })
  it('is_presenter true면 발제자', () => {
    expect(isPresenterRow({ payment_method: 'none', is_presenter: true })).toBe(true)
  })
})

describe('planMoney — 갈래별 돈과 옛 행 refunded_amount (0 = 받은 돈 없음 / null = 환불 대기)', () => {
  it('신청 없음 → none, 돈 없음', () => {
    const p = planMoney(null)
    expect(p).toMatchObject({ ok: true, kind: 'none', refundAmount: 0, callPortone: false })
  })
  it('카드 confirmed 유료 → PortOne 전액 취소, 옛 행 = paid', () => {
    expect(planMoney(cand({}))).toEqual({
      ok: true, kind: 'card_full_refund', refundAmount: 25000, callPortone: true, closeRefundedAmount: 25000,
    })
  })
  it('🔴 카드인데 PortOne이 이미 CANCELLED → 다시 부르지 않는다 (재시도 자리)', () => {
    expect(planMoney(cand({}), { portoneCancelled: true })).toEqual({
      ok: true, kind: 'card_already_refunded', refundAmount: 25000, callPortone: false, closeRefundedAmount: 25000,
    })
  })
  it('🔴 계좌이체 confirmed 유료 → 옛 행 NULL (운영자 손 환불 대기)', () => {
    expect(planMoney(cand({ paymentMethod: 'transfer', hasPaymentId: false }))).toEqual({
      ok: true, kind: 'transfer_manual_refund', refundAmount: 25000, callPortone: false, closeRefundedAmount: null,
    })
  })
  it('confirmed 0원 → zero_paid, 옛 행 0', () => {
    expect(planMoney(cand({ paymentMethod: 'transfer', paidAmount: 0 }))).toMatchObject({
      ok: true, kind: 'zero_paid', refundAmount: 0, closeRefundedAmount: 0,
    })
  })
  it('🔴 입금 대기 + 답 없음 → 막는다 (0과 NULL을 추측하지 않는다)', () => {
    expect(planMoney(cand({ status: 'pending_transfer', paymentMethod: 'transfer' }))).toEqual({
      ok: false, reason: 'deposit_answer_required',
    })
  })
  it('🔴 입금 대기 + 「들어왔다」 → NULL (환불 대기)', () => {
    expect(
      planMoney(cand({ status: 'pending_transfer', paymentMethod: 'transfer' }), { pendingDeposited: true }),
    ).toMatchObject({ ok: true, kind: 'pending_deposited', refundAmount: 25000, closeRefundedAmount: null })
  })
  it('🔴 입금 대기 + 「안 들어왔다」 → 0', () => {
    expect(
      planMoney(cand({ status: 'pending_transfer', paymentMethod: 'transfer' }), { pendingDeposited: false }),
    ).toMatchObject({ ok: true, kind: 'pending_no_money', refundAmount: 0, closeRefundedAmount: 0 })
  })
  it('입금 대기 0원 → 묻지 않고 0', () => {
    expect(
      planMoney(cand({ status: 'pending_transfer', paymentMethod: 'transfer', paidAmount: 0 })),
    ).toMatchObject({ ok: true, kind: 'pending_no_money', closeRefundedAmount: 0 })
  })
  it('대기 카드 유료 → PortOne 전액 취소', () => {
    expect(planMoney(cand({ status: 'waitlisted' }))).toMatchObject({
      ok: true, kind: 'waitlist_card_refund', callPortone: true, closeRefundedAmount: 25000,
    })
  })
  it('대기 카드 유료인데 PortOne 이미 취소 → 다시 안 부른다', () => {
    expect(planMoney(cand({ status: 'waitlisted' }), { portoneCancelled: true })).toMatchObject({
      kind: 'card_already_refunded', callPortone: false,
    })
  })
  it('대기 계좌이체 → 0 (waitlist.ts 대기 취소와 같다)', () => {
    expect(planMoney(cand({ status: 'waitlisted', paymentMethod: 'transfer', paidAmount: 0 }))).toMatchObject({
      ok: true, kind: 'waitlist_no_money', closeRefundedAmount: 0,
    })
  })
  it('살아 있는 행에 환불액이 있으면 멈춘다 (장부 정리분 같은 행)', () => {
    expect(planMoney(cand({ paidAmount: 0, refundedAmount: 12000 }))).toEqual({
      ok: false, reason: 'ledger_irregular',
    })
  })
  it('카드 유료인데 결제 번호가 없으면 멈춘다', () => {
    expect(planMoney(cand({ hasPaymentId: false }))).toEqual({ ok: false, reason: 'card_no_payment_id' })
  })
  it('카드 환불 완료 표시가 필요한 갈래', () => {
    expect(needsCardRefundDone('card_full_refund')).toBe(true)
    expect(needsCardRefundDone('card_already_refunded')).toBe(true)
    expect(needsCardRefundDone('transfer_manual_refund')).toBe(false)
  })
})

describe('planSeat — 정원 (confirmed + pending_transfer)', () => {
  it('정원 참 + 새 회원 → 막는다', () => {
    expect(planSeat({ capacity: 10, seatedCount: 10, candidateStatus: null }).allowed).toBe(false)
  })
  it('🔴 정원 참 + 이미 자리 가진 회원 → 허용, 자리 그대로 (대표님 확정 ⑧)', () => {
    const s = planSeat({ capacity: 10, seatedCount: 10, candidateStatus: 'confirmed' })
    expect(s).toEqual({ allowed: true, takesNewSeat: false, remainingBefore: 0, remainingAfter: 0 })
    expect(planSeat({ capacity: 10, seatedCount: 10, candidateStatus: 'pending_transfer' }).allowed).toBe(true)
  })
  it('정원 참 + 대기자 → 새 자리가 필요해 막는다', () => {
    expect(planSeat({ capacity: 10, seatedCount: 10, candidateStatus: 'waitlisted' }).allowed).toBe(false)
  })
  it('자리 남음 + 새 회원 → 남은 자리 7 → 6', () => {
    expect(planSeat({ capacity: 10, seatedCount: 3, candidateStatus: null })).toEqual({
      allowed: true, takesNewSeat: true, remainingBefore: 7, remainingAfter: 6,
    })
  })
})

describe('meetingBlock', () => {
  const today = '2026-10-13'
  it('정기모임·지난 모임·진행 중 아님은 막는다', () => {
    expect(meetingBlock(null, today)).toBe('not_found')
    expect(meetingBlock({ status: 'deleting', meeting_type: 'discussion', date: '2026-10-27' }, today)).toBe('not_active')
    expect(meetingBlock({ status: 'active', meeting_type: 'regular', date: '2026-10-27' }, today)).toBe('not_discussion')
    expect(meetingBlock({ status: 'active', meeting_type: 'discussion', date: '2026-10-12' }, today)).toBe('meeting_passed')
  })
  it('당일 토론모임은 지정 가능', () => {
    expect(meetingBlock({ status: 'active', meeting_type: 'discussion', date: today }, today)).toBeNull()
  })
})

describe('runPresenterAssign — PortOne 먼저, 성공해야 RPC (설계서 §3-3)', () => {
  function deps(over: Partial<AssignDeps> = {}): AssignDeps & {
    cancelPayment: ReturnType<typeof vi.fn>
    callAssignRpc: ReturnType<typeof vi.fn>
  } {
    return {
      rpcReady: vi.fn(async () => true),
      cancelPayment: vi.fn(async () => {}),
      getPaymentStatus: vi.fn(async () => 'PAID'),
      callAssignRpc: vi.fn(async () => ({ result: 'success' })),
      ...over,
    } as never
  }

  it('🔴 DB 작업 전(RPC 없음)이면 PortOne을 부르지 않는다', async () => {
    const d = deps({ rpcReady: vi.fn(async () => false) })
    expect(await runPresenterAssign('card_full_refund', d)).toEqual({ status: 'not_ready' })
    expect(d.cancelPayment).not.toHaveBeenCalled()
    expect(d.callAssignRpc).not.toHaveBeenCalled()
  })
  it('카드 → 환불 후 RPC(cardRefunded=true)', async () => {
    const d = deps()
    expect(await runPresenterAssign('card_full_refund', d)).toEqual({ status: 'success' })
    expect(d.cancelPayment).toHaveBeenCalledTimes(1)
    expect(d.callAssignRpc).toHaveBeenCalledWith(true)
  })
  it('🔴 PortOne 실패 + 취소 안 됨 → RPC를 부르지 않는다 (아무것도 안 바뀜)', async () => {
    const d = deps({ cancelPayment: vi.fn(async () => { throw new Error('x') }) })
    expect(await runPresenterAssign('card_full_refund', d)).toEqual({ status: 'refund_failed' })
    expect(d.callAssignRpc).not.toHaveBeenCalled()
  })
  it('PortOne 실패인데 이미 CANCELLED(동시 요청) → RPC로 마무리', async () => {
    const d = deps({
      cancelPayment: vi.fn(async () => { throw new Error('x') }),
      getPaymentStatus: vi.fn(async () => 'CANCELLED'),
    })
    expect(await runPresenterAssign('waitlist_card_refund', d)).toEqual({ status: 'success' })
    expect(d.callAssignRpc).toHaveBeenCalledWith(true)
  })
  it('🔴 card_already_refunded → PortOne 다시 안 부르고 cardRefunded=true', async () => {
    const d = deps()
    await runPresenterAssign('card_already_refunded', d)
    expect(d.cancelPayment).not.toHaveBeenCalled()
    expect(d.callAssignRpc).toHaveBeenCalledWith(true)
  })
  it('계좌이체 → PortOne 없음, cardRefunded=false', async () => {
    const d = deps()
    await runPresenterAssign('transfer_manual_refund', d)
    expect(d.cancelPayment).not.toHaveBeenCalled()
    expect(d.callAssignRpc).toHaveBeenCalledWith(false)
  })
  it('🔴 환불 뒤 RPC 실패 → refunded_but_not_switched (기록·재시도 안내 대상)', async () => {
    const d = deps({ callAssignRpc: vi.fn(async () => ({ error: 'boom' })) })
    expect(await runPresenterAssign('card_full_refund', d)).toEqual({
      status: 'refunded_but_not_switched', result: 'db_error',
    })
  })
  it('돈 안 움직인 RPC 거절 → rejected', async () => {
    const d = deps({ callAssignRpc: vi.fn(async () => ({ result: 'capacity_full' })) })
    expect(await runPresenterAssign('none', d)).toEqual({ status: 'rejected', result: 'capacity_full' })
  })
  it('대기 카드 환불 뒤 자리 참 → capacity_full_refunded', async () => {
    const d = deps({ callAssignRpc: vi.fn(async () => ({ result: 'capacity_full_refunded' })) })
    expect(await runPresenterAssign('waitlist_card_refund', d)).toEqual({ status: 'capacity_full_refunded' })
  })
})

describe('recommendedTransferRefund — 환불 완료 토글이 적는 값', () => {
  const base = { meetingType: 'discussion', meetingDate: '2026-10-27', paidAmount: 25000 }
  it('🔴 발제자로 바꿈 → D-1이어도 전액', () => {
    expect(recommendedTransferRefund({ ...base, cancelType: 'presenter_swap', cancelDate: '2026-10-26' })).toBe(25000)
  })
  it('🔴 모임 삭제 → D-1이어도 전액', () => {
    expect(recommendedTransferRefund({ ...base, cancelType: 'meeting_deleted', cancelDate: '2026-10-26' })).toBe(25000)
  })
  it('회원 취소는 규정(토론 14/7) 그대로', () => {
    expect(recommendedTransferRefund({ ...base, cancelType: 'user_cancelled', cancelDate: '2026-10-26' })).toBe(0)
    expect(recommendedTransferRefund({ ...base, cancelType: 'user_cancelled', cancelDate: '2026-10-13' })).toBe(25000)
  })
})

describe('transferCloseRefundedAmount — 계좌이체 신청을 닫을 때 (0 = 받은 돈 없음 / null = 환불 대기)', () => {
  it('입금 전 취소 → 0', () => {
    expect(transferCloseRefundedAmount({ wasPendingTransfer: true, paidAmount: 25000 })).toBe(0)
  })
  it('🔴 0원 confirmed → 0 (종전에는 NULL로 적혀 「환불 대기」로 세어졌다)', () => {
    expect(transferCloseRefundedAmount({ wasPendingTransfer: false, paidAmount: 0 })).toBe(0)
    expect(transferCloseRefundedAmount({ wasPendingTransfer: false, paidAmount: null })).toBe(0)
  })
  it('입금된 confirmed → null (운영자 손 환불 대기)', () => {
    expect(transferCloseRefundedAmount({ wasPendingTransfer: false, paidAmount: 25000 })).toBeNull()
  })
})

describe('빼기 확인 창·검색 보조', () => {
  it('대기 1번이 카드·0원이면 바로 확정, 금액 있는 계좌이체면 입금 확인 중', () => {
    expect(firstWaitlistedGoesConfirmed({ payment_method: 'card', paid_amount: 25000 })).toBe(true)
    expect(firstWaitlistedGoesConfirmed({ payment_method: 'transfer', paid_amount: 0 })).toBe(true)
    expect(firstWaitlistedGoesConfirmed({ payment_method: 'transfer', paid_amount: 25000 })).toBe(false)
  })
  it('검색어에서 PostgREST or 문법 글자를 뺀다', () => {
    expect(sanitizeMemberQuery('책),role.eq.admin')).toBe('책  role eq admin')
    expect(sanitizeMemberQuery('  ')).toBe('')
    expect(sanitizeMemberQuery('%')).toBe('')
  })
})
