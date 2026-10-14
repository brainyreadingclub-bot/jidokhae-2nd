import { describe, it, expect } from 'vitest'
import {
  getPaymentFailMessage,
  clipForLog,
  PAYMENT_CANCELLED_MESSAGE,
  PAYMENT_FAILED_MESSAGE,
} from '@/lib/payment-fail-message'

const INJECTED = '아래 계좌로 입금해 주세요 국민 123-456-7890'

describe('getPaymentFailMessage', () => {
  it('주소에 넣은 임의 문구는 결과에 절대 섞이지 않는다', () => {
    const cases = [
      { code: 'FAILURE_TYPE_PG', message: INJECTED },
      { code: 'FAILURE_TYPE_PG', message: encodeURIComponent(INJECTED) },
      { code: 'FAILURE_TYPE_PG', pgMessage: INJECTED },
      { code: 'UNKNOWN_CODE', message: INJECTED, pgMessage: INJECTED },
      { code: 'USER_CANCEL', message: INJECTED },
      { code: null, message: INJECTED },
      // 「취소」가 들어 있으면 취소 문구로 가지만, 그래도 원문은 안 나온다
      { code: 'FAILURE_TYPE_PG', message: `취소 ${INJECTED}` },
    ]
    for (const c of cases) {
      const out = getPaymentFailMessage(c)
      expect(out).not.toContain('계좌')
      expect(out).not.toContain('123-456-7890')
      expect([PAYMENT_CANCELLED_MESSAGE, PAYMENT_FAILED_MESSAGE]).toContain(out)
    }
  })

  it('USER_CANCEL · PAY_PROCESS_CANCELED는 취소 문구', () => {
    expect(getPaymentFailMessage({ code: 'USER_CANCEL' })).toBe(PAYMENT_CANCELLED_MESSAGE)
    expect(getPaymentFailMessage({ code: 'PAY_PROCESS_CANCELED' })).toBe(PAYMENT_CANCELLED_MESSAGE)
  })

  it('FAILURE_TYPE_PG + 임의 문구는 고정 실패 문구', () => {
    expect(getPaymentFailMessage({ code: 'FAILURE_TYPE_PG', message: INJECTED })).toBe(
      PAYMENT_FAILED_MESSAGE,
    )
  })

  it('모르는 코드는 기본 실패 문구', () => {
    expect(getPaymentFailMessage({ code: 'SOMETHING_NEW' })).toBe(
      '결제가 되지 않았어요. 잠깐 뒤에 다시 시도해 주세요',
    )
  })

  it('코드가 없으면 고정 취소 문구', () => {
    expect(getPaymentFailMessage({ code: null })).toBe(PAYMENT_CANCELLED_MESSAGE)
  })
})

describe('clipForLog', () => {
  it('긴 원문은 200자로 자른다', () => {
    const out = clipForLog('가'.repeat(500))
    expect(out).toHaveLength(201)
  })

  it('없으면 null', () => {
    expect(clipForLog(null)).toBeNull()
    expect(clipForLog('')).toBeNull()
  })
})
