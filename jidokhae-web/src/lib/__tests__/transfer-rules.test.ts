import { describe, it, expect } from 'vitest'
import {
  isSeatedTransferResult,
  transferDoneHref,
  showsDepositGuide,
  isNoTransferNeeded,
} from '@/lib/transfer-rules'

// 2026-10-13 — 0원 모임 계좌이체 신청은 처음부터 신청 완료(register_transfer → 'confirmed')

describe('isSeatedTransferResult — 신청 완료 알림톡 대상', () => {
  it('🔴 0원 confirmed도 알림톡 대상이다 (pending_transfer와 같은 방식)', () => {
    expect(isSeatedTransferResult('confirmed')).toBe(true)
    expect(isSeatedTransferResult('pending_transfer')).toBe(true)
  })
  it('대기·거절은 대상 아님', () => {
    expect(isSeatedTransferResult('waitlisted')).toBe(false)
    expect(isSeatedTransferResult('waitlist_card_only')).toBe(false)
  })
})

describe('transferDoneHref — 신청 직후 완료 화면', () => {
  it('🔴 confirmed → 입금 안내 없는 완료 화면 (모르는 값으로 떨어져 「실패」 토스트가 뜨지 않게)', () => {
    expect(transferDoneHref('m1', 'confirmed')).toBe('/meetings/m1/confirm')
  })
  it('pending_transfer · waitlisted는 그대로', () => {
    expect(transferDoneHref('m1', 'pending_transfer')).toBe('/meetings/m1/confirm?type=pending_transfer')
    expect(transferDoneHref('m1', 'waitlisted')).toBe('/meetings/m1/confirm?type=waitlisted')
  })
  it('오류 값은 null', () => {
    expect(transferDoneHref('m1', 'error')).toBeNull()
  })
})

describe('showsDepositGuide — 완료 화면의 계좌·입금 안내', () => {
  it('🔴 0원 모임은 pending_transfer로 와도 안 띄운다 (SQL 실행 전 구간)', () => {
    expect(showsDepositGuide('pending_transfer', 0)).toBe(false)
  })
  it('유료 입금 대기는 띄운다', () => {
    expect(showsDepositGuide('pending_transfer', 25000)).toBe(true)
  })
  it('신청 완료·대기에는 안 띄운다', () => {
    expect(showsDepositGuide(undefined, 25000)).toBe(false)
    expect(showsDepositGuide('waitlisted', 25000)).toBe(false)
  })
})

describe('isNoTransferNeeded — 계좌이체 단계 입금 안내 숨김', () => {
  it('0원 모임 · 0원 청구면 숨긴다', () => {
    expect(isNoTransferNeeded(0, 0)).toBe(true)
  })
  it('🔴 유료 모임이면 청구액이 무엇이든 보인다 (서버 판정과 같은 두 조건)', () => {
    expect(isNoTransferNeeded(10000, 0)).toBe(false)
    expect(isNoTransferNeeded(10000, 5000)).toBe(false)
  })
})
