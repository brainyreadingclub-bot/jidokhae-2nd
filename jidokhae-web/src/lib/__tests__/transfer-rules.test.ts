import { describe, it, expect } from 'vitest'
import {
  isSeatedTransferResult,
  transferDoneHref,
  showsDepositGuide,
  isNoTransferNeeded,
  registerEntry,
  showsCardOption,
} from '@/lib/transfer-rules'
import { isAllowedCardAmount } from '@/lib/pricing'

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

describe('registerEntry — 신청 버튼을 누르면 어디로 (0원은 카드 선택지 없음)', () => {
  it('🔴 0원이면 결제 방식과 상관없이 계좌이체 단계로 바로 (card_only에서도 신청 길이 열려 있게)', () => {
    expect(registerEntry('card_only', 0)).toBe('transfer')
    expect(registerEntry('both', 0)).toBe('transfer')
    expect(registerEntry('transfer_only', 0)).toBe('transfer')
    expect(registerEntry(undefined, 0)).toBe('transfer')
  })
  it('유료는 종전 그대로', () => {
    expect(registerEntry('both', 10000)).toBe('method')
    expect(registerEntry('transfer_only', 10000)).toBe('method')
    expect(registerEntry('card_only', 10000)).toBe('card')
    expect(registerEntry(undefined, 5000)).toBe('card')
  })
})

describe('showsCardOption — 결제 방법 창의 카드 선택지', () => {
  it('🔴 0원이면 숨긴다', () => {
    expect(showsCardOption(0)).toBe(false)
  })
  it('유료면 보인다', () => {
    expect(showsCardOption(10000)).toBe(true)
  })
})

describe('isAllowedCardAmount — 서버 카드 금액 화이트리스트', () => {
  it('🔴 0원 모임의 0원 카드 결제는 거절 (종전 화이트리스트가 [0]이라 통과했다)', () => {
    expect(isAllowedCardAmount(0, 'regular', 0)).toBe(false)
    expect(isAllowedCardAmount(0, 'discussion', 0)).toBe(false)
  })
  it('0원 모임에 금액이 실린 결제도 거절 (호출부가 safeCancel로 돌려준다)', () => {
    expect(isAllowedCardAmount(0, 'regular', 10000)).toBe(false)
  })
  it('정가 · 정기모임 스텝 50%는 허용, 토론모임 스텝가는 거절', () => {
    expect(isAllowedCardAmount(10000, 'regular', 10000)).toBe(true)
    expect(isAllowedCardAmount(10000, 'regular', 5000)).toBe(true)
    expect(isAllowedCardAmount(25000, 'discussion', 25000)).toBe(true)
    expect(isAllowedCardAmount(25000, 'discussion', 12500)).toBe(false)
  })
})
