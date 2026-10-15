import { describe, it, expect } from 'vitest'
import { isCancelledBeforeDeposit, transferCloseRefundedAmount } from '@/lib/refund'

// 2026-10-15 대표님 1안 — 계좌이체 취소의 refunded_amount 0은 「입금 전 취소」 또는 「0원 신청」뿐이다.
// 결제 금액 > 0이면 입금 전 취소로 확정 → 회원 화면 「입금 전 취소」 + 운영 정산 읽기 전용 목록
const base = { status: 'cancelled', payment_method: 'transfer', refunded_amount: 0, paid_amount: 10000 }

describe('isCancelledBeforeDeposit', () => {
  it('계좌이체 + 환불 0 + 결제 금액 > 0 → 입금 전 취소', () => {
    expect(isCancelledBeforeDeposit(base)).toBe(true)
  })
  it('0원 모임 취소(결제 금액 0)는 아니다', () => {
    expect(isCancelledBeforeDeposit({ ...base, paid_amount: 0 })).toBe(false)
    expect(isCancelledBeforeDeposit({ ...base, paid_amount: null })).toBe(false)
  })
  it('입금 확인 뒤 취소(환불 대기 null)는 아니다 — 0과 null을 합치지 않는다', () => {
    expect(isCancelledBeforeDeposit({ ...base, refunded_amount: null })).toBe(false)
  })
  it('환불이 끝난 건(> 0)은 아니다', () => {
    expect(isCancelledBeforeDeposit({ ...base, refunded_amount: 5000 })).toBe(false)
  })
  it('카드 취소의 0(규정상 0원 환불)은 아니다', () => {
    expect(isCancelledBeforeDeposit({ ...base, payment_method: 'card' })).toBe(false)
  })
  it('취소가 아니면 아니다', () => {
    expect(isCancelledBeforeDeposit({ ...base, status: 'pending_transfer' })).toBe(false)
  })
  it('닫을 때 쓰는 규칙과 맞물린다 — 입금 전 취소만 0 + 결제 금액 > 0 조합을 만든다', () => {
    const pending = transferCloseRefundedAmount({ wasPendingTransfer: true, paidAmount: 10000 })
    const deposited = transferCloseRefundedAmount({ wasPendingTransfer: false, paidAmount: 10000 })
    const free = transferCloseRefundedAmount({ wasPendingTransfer: false, paidAmount: 0 })
    expect(isCancelledBeforeDeposit({ ...base, refunded_amount: pending })).toBe(true)
    expect(isCancelledBeforeDeposit({ ...base, refunded_amount: deposited })).toBe(false)
    expect(isCancelledBeforeDeposit({ ...base, refunded_amount: free, paid_amount: 0 })).toBe(false)
  })
})
