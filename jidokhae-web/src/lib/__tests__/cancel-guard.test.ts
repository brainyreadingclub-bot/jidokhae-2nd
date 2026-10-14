import { describe, it, expect } from 'vitest'
import { isRefundAlreadyApplied } from '@/lib/cancel-guard'

describe('isRefundAlreadyApplied — 전액 환불', () => {
  it('CANCELLED면 이미 처리됨', () => {
    expect(isRefundAlreadyApplied({ status: 'CANCELLED', cancelledAmount: 10000 }, 10000, true)).toBe(true)
  })
  it('PAID면 처리 안 됨(진짜 실패)', () => {
    expect(isRefundAlreadyApplied({ status: 'PAID', cancelledAmount: 0 }, 10000, true)).toBe(false)
  })
  it('PARTIAL_CANCELLED는 전액 환불이 된 것이 아니다', () => {
    expect(isRefundAlreadyApplied({ status: 'PARTIAL_CANCELLED', cancelledAmount: 5000 }, 10000, true)).toBe(false)
  })
})

describe('isRefundAlreadyApplied — 50% 부분 환불', () => {
  it('먼저 온 요청이 같은 금액을 이미 돌려줬으면 처리됨 → 늦은 요청은 이미 처리됨으로 끝난다', () => {
    expect(isRefundAlreadyApplied({ status: 'PARTIAL_CANCELLED', cancelledAmount: 5000 }, 5000, false)).toBe(true)
  })
  it('아직 아무것도 안 나갔으면(PAID) 실패로 돌린다 — 다시 시도하게', () => {
    expect(isRefundAlreadyApplied({ status: 'PAID', cancelledAmount: 0 }, 5000, false)).toBe(false)
  })
  it('누적 취소액이 다르면 다른 취소가 섞인 것 — 처리됨으로 보지 않는다', () => {
    expect(isRefundAlreadyApplied({ status: 'PARTIAL_CANCELLED', cancelledAmount: 3000 }, 5000, false)).toBe(false)
  })
  it('전액 취소된 결제를 부분 환불 성공으로 보지 않는다', () => {
    expect(isRefundAlreadyApplied({ status: 'CANCELLED', cancelledAmount: 10000 }, 5000, false)).toBe(false)
  })
})
