import { describe, it, expect } from 'vitest'
import { isPaymentCancelled } from '@/lib/payment-cancel'

describe('isPaymentCancelled', () => {
  it('옛 화면이 취소로 보던 코드는 취소', () => {
    expect(isPaymentCancelled({ code: 'USER_CANCEL' })).toBe(true)
    expect(isPaymentCancelled({ code: 'PAY_PROCESS_CANCELED' })).toBe(true)
  })

  it('포트원 SDK의 Cancelled 코드는 취소', () => {
    expect(isPaymentCancelled({ code: 'Cancelled' })).toBe(true)
  })

  it('PG 코드가 취소면 취소', () => {
    expect(isPaymentCancelled({ code: 'FAILURE_TYPE_PG', pgCode: 'USER_CANCEL' })).toBe(true)
  })

  it('PG 문구에 「취소」가 있으면 취소 (인코딩된 문구 포함)', () => {
    expect(
      isPaymentCancelled({ code: 'FAILURE_TYPE_PG', message: encodeURIComponent('사용자가 결제를 취소하였습니다') }),
    ).toBe(true)
    expect(isPaymentCancelled({ code: 'FAILURE_TYPE_PG', pgMessage: '결제취소' })).toBe(true)
  })

  it('잔액 부족 같은 실패는 취소가 아니다', () => {
    expect(isPaymentCancelled({ code: 'FAILURE_TYPE_PG', message: '잔액이 부족합니다' })).toBe(false)
    expect(isPaymentCancelled({ code: 'PGProviderError', message: null })).toBe(false)
  })

  it('깨진 인코딩도 던지지 않는다', () => {
    expect(isPaymentCancelled({ code: 'X', message: '%E0%A4%A' })).toBe(false)
  })
})
