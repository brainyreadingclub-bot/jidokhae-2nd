import { describe, it, expect } from 'vitest'
import { isWaitlistCardOnly, resolvePromotedConfirmed, confirmAmountText } from '@/lib/waitlist-rules'

describe('isWaitlistCardOnly — 대기 신청은 카드만 (2026-10-09)', () => {
  it('유료 대기 → 계좌이체를 감춘다', () => {
    expect(isWaitlistCardOnly(true, 10000)).toBe(true)
  })

  it('스텝 할인가 대기도 돈이 걸렸으므로 감춘다', () => {
    expect(isWaitlistCardOnly(true, 5000)).toBe(true)
  })

  it('0원 대기 → 계좌이체 허용 (받을 돈이 없다)', () => {
    expect(isWaitlistCardOnly(true, 0)).toBe(false)
  })

  it('is_free 회원의 유료 대기 → 계좌이체 허용 (결정 A)', () => {
    expect(isWaitlistCardOnly(true, 10000, true)).toBe(false)
    expect(isWaitlistCardOnly(true, 5000, true)).toBe(false)
  })

  it('is_free가 아닌 회원의 유료 대기 → 감춘다 (명시 false)', () => {
    expect(isWaitlistCardOnly(true, 10000, false)).toBe(true)
  })

  it('대기가 아니면 금액과 무관하게 감추지 않는다', () => {
    expect(isWaitlistCardOnly(false, 10000)).toBe(false)
    expect(isWaitlistCardOnly(false, 0)).toBe(false)
  })
})

describe('resolvePromotedConfirmed — 승격 알림톡 판정', () => {
  it('새 RPC 값이 있으면 그 값을 그대로 따른다', () => {
    expect(resolvePromotedConfirmed(true, 'transfer')).toBe(true) // 0원 계좌이체 → 확정
    expect(resolvePromotedConfirmed(false, 'card')).toBe(false)
  })

  it('옛 RPC(컬럼 없음)면 결제 수단으로 떨어진다 — 카드 승격 알림이 멈추지 않는다', () => {
    expect(resolvePromotedConfirmed(undefined, 'card')).toBe(true)
    expect(resolvePromotedConfirmed(undefined, null)).toBe(true)
    expect(resolvePromotedConfirmed(undefined, 'transfer')).toBe(false)
  })

  it('is_free 회원의 유료 계좌이체 승격 → RPC가 pending_transfer(false)를 주면 알림톡 없음', () => {
    // 승격은 그 건의 금액으로만 가른다 — is_free라도 금액이 걸리면 pending_transfer (결정 A)
    expect(resolvePromotedConfirmed(false, 'transfer')).toBe(false)
  })

  it('null도 옛 판정으로 떨어진다', () => {
    expect(resolvePromotedConfirmed(null, 'card')).toBe(true)
    expect(resolvePromotedConfirmed(null, 'transfer')).toBe(false)
  })
})

describe('confirmAmountText — 신청 완료 알림톡 #{결제금액}', () => {
  it('카드 확정 → 금액만 (종전과 같다)', () => {
    expect(confirmAmountText(10000, 10000, 'confirmed')).toBe('10,000')
  })

  it('계좌이체 입금 전 → 금액 뒤에 상태 라벨', () => {
    expect(confirmAmountText(10000, 10000, 'pending_transfer')).toBe('10,000 (입금 확인 중)')
  })

  it('스텝 할인 계좌이체 → 낼 돈 + 라벨', () => {
    expect(confirmAmountText(5000, 10000, 'pending_transfer')).toBe('5,000 (입금 확인 중)')
  })

  it('0원 모임 계좌이체 → 「무료」만, 라벨 없음', () => {
    expect(confirmAmountText(0, 0, 'pending_transfer')).toBe('무료')
  })

  it('「미입금」이라고 쓰지 않는다', () => {
    expect(confirmAmountText(10000, 10000, 'pending_transfer')).not.toContain('미입금')
  })

  it('금액에 단위를 붙이지 않는다', () => {
    expect(confirmAmountText(10000, 10000, 'pending_transfer')).not.toMatch(/원|₩/)
  })
})
