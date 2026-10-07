import { describe, it, expect } from 'vitest'
import { PARTICIPATED_STATUSES, paymentStatusLabel } from '@/lib/registration-status'

describe('paymentStatusLabel', () => {
  it('계좌이체 입금 확인 전에는 "입금 확인 중"', () => {
    expect(paymentStatusLabel('pending_transfer')).toBe('입금 확인 중')
  })

  it('"미입금"이라고 부르지 않는다 — 월말 일괄 확인이라 대부분 이미 냈다', () => {
    expect(paymentStatusLabel('pending_transfer')).not.toContain('미입금')
  })

  it('결제 완료 건은 "결제완료"', () => {
    expect(paymentStatusLabel('confirmed')).toBe('결제완료')
  })

  it('참여 판정 status 두 가지 모두 라벨이 나온다 — 알림톡 변수가 비면 치환 오류로 발송이 막힌다', () => {
    for (const status of PARTICIPATED_STATUSES) {
      expect(paymentStatusLabel(status)).toBeTruthy()
    }
  })
})
