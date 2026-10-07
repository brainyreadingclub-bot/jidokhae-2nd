/**
 * KST (Korea Standard Time) 유틸리티 단위 테스트
 * 시나리오 6-1-09, 6-1-15 관련
 */

import { describe, it, expect } from 'vitest'
import {
  getKSTToday,
  getTomorrowKST,
  toKSTDate,
  formatKoreanDate,
  formatKoreanTime,
  formatFee,
  formatMeetingFee,
  formatPaidAmount,
  formatPaidAmountWithUnit,
  getDaysUntil,
  getMeetingTiming,
  getButtonState,
} from '@/lib/kst'

// ─── getKSTToday ───

describe('getKSTToday', () => {
  it('YYYY-MM-DD 형식 반환', () => {
    const today = getKSTToday()
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('유효한 날짜 문자열 반환', () => {
    const today = getKSTToday()
    const parsed = new Date(today + 'T00:00:00')
    expect(parsed.toString()).not.toBe('Invalid Date')
  })
})

// ─── getTomorrowKST ───

describe('getTomorrowKST', () => {
  it('YYYY-MM-DD 형식 반환', () => {
    const tomorrow = getTomorrowKST()
    expect(tomorrow).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('오늘보다 하루 뒤의 날짜 반환', () => {
    const today = getKSTToday()
    const tomorrow = getTomorrowKST()
    const todayDate = new Date(today + 'T12:00:00+09:00')
    const tomorrowDate = new Date(tomorrow + 'T12:00:00+09:00')
    const diffMs = tomorrowDate.getTime() - todayDate.getTime()
    const diffDays = diffMs / (24 * 60 * 60 * 1000)
    expect(diffDays).toBe(1)
  })
})

// ─── toKSTDate ───

describe('toKSTDate', () => {
  it('KST 기준 날짜로 변환', () => {
    const result = toKSTDate(new Date('2026-03-10T00:00:00+09:00'))
    expect(result).toBe('2026-03-10')
  })

  it('UTC 15:00 → KST 다음날 00:00', () => {
    // UTC 2026-03-10 15:00:00 = KST 2026-03-11 00:00:00
    const result = toKSTDate(new Date('2026-03-10T15:00:00Z'))
    expect(result).toBe('2026-03-11')
  })

  it('UTC 14:59 → KST 같은 날 23:59', () => {
    // UTC 2026-03-10 14:59:00 = KST 2026-03-10 23:59:00
    const result = toKSTDate(new Date('2026-03-10T14:59:00Z'))
    expect(result).toBe('2026-03-10')
  })
})

// ─── formatKoreanDate ───

describe('formatKoreanDate', () => {
  it('"2026-03-10" → "3월 10일 (화)"', () => {
    expect(formatKoreanDate('2026-03-10')).toBe('3월 10일 (화)')
  })

  it('"2026-03-15" → "3월 15일 (일)"', () => {
    expect(formatKoreanDate('2026-03-15')).toBe('3월 15일 (일)')
  })

  it('"2026-01-01" → "1월 1일 (목)"', () => {
    expect(formatKoreanDate('2026-01-01')).toBe('1월 1일 (목)')
  })

  it('"2026-12-25" → "12월 25일 (금)"', () => {
    expect(formatKoreanDate('2026-12-25')).toBe('12월 25일 (금)')
  })
})

// ─── formatKoreanTime ───

describe('formatKoreanTime', () => {
  it('"19:00:00" → "오후 7:00"', () => {
    expect(formatKoreanTime('19:00:00')).toBe('오후 7:00')
  })

  it('"19:00" → "오후 7:00"', () => {
    expect(formatKoreanTime('19:00')).toBe('오후 7:00')
  })

  it('"09:30" → "오전 9:30"', () => {
    expect(formatKoreanTime('09:30')).toBe('오전 9:30')
  })

  it('"00:00" → "오전 12:00"', () => {
    expect(formatKoreanTime('00:00')).toBe('오전 12:00')
  })

  it('"12:00" → "오후 12:00"', () => {
    expect(formatKoreanTime('12:00')).toBe('오후 12:00')
  })

  it('"13:30" → "오후 1:30"', () => {
    expect(formatKoreanTime('13:30')).toBe('오후 1:30')
  })

  it('"" → ""', () => {
    expect(formatKoreanTime('')).toBe('')
  })
})

// ─── formatFee ───

describe('formatFee', () => {
  it('10000 → "10,000"', () => {
    expect(formatFee(10000)).toBe('10,000')
  })

  it('0 → "0"', () => {
    expect(formatFee(0)).toBe('0')
  })

  it('1000 → "1,000"', () => {
    expect(formatFee(1000)).toBe('1,000')
  })

  it('100000 → "100,000"', () => {
    expect(formatFee(100000)).toBe('100,000')
  })
})

// ─── formatMeetingFee / formatPaidAmount ───
//
// 규칙 하나뿐이다 — **「무료」는 모임이 0원일 때만.**
// 0을 "0"으로 쓰면 값을 못 불러온 것처럼 보이고(2026-10-07 대구 무료 모임),
// 결제액으로 판정하면 유료 모임에 「무료」가 뜬다(2026-10-06 중복환불 장부 정리).
// 둘 다 실제로 prod에서 일어난 일이라 테스트로 박아둔다.

describe('formatMeetingFee', () => {
  it('0원 모임 → "무료"', () => {
    expect(formatMeetingFee(0)).toBe('무료')
  })

  it('유료 모임 → 숫자 그대로', () => {
    expect(formatMeetingFee(12000)).toBe('12,000')
    expect(formatMeetingFee(6000)).toBe('6,000')
  })
})

describe('formatPaidAmount', () => {
  it('0원 모임 → "무료"', () => {
    expect(formatPaidAmount(0, 0)).toBe('무료')
  })

  it('유료 모임 정상 결제 → 숫자 그대로', () => {
    expect(formatPaidAmount(12000, 12000)).toBe('12,000')
  })

  it('유료 모임 + 스텝 할인 결제 → 결제액 그대로 ("무료" 아님)', () => {
    expect(formatPaidAmount(6000, 12000)).toBe('6,000')
  })

  // 🔴 회귀 방지 — 이 케이스 때문에 판정 기준을 결제액에서 모임 참가비로 옮겼다.
  // 2026-10-06 중복환불 사고로 신청은 남기고 돈만 돌려드린 뒤 장부를 0으로 맞춘
  // 건들이 prod에 있다. 그 건은 "0원으로 처리됐다"이지 "공짜 모임"이 아니다.
  it('🔴 유료 모임인데 결제액이 0 → "무료"가 아니라 "0"', () => {
    expect(formatPaidAmount(0, 12000)).toBe('0')
  })

  it('0원 모임이면 결제액이 무엇이든 "무료"', () => {
    expect(formatPaidAmount(0, 0)).toBe('무료')
    expect(formatPaidAmount(12000, 0)).toBe('무료')
  })
})

describe('formatPaidAmountWithUnit', () => {
  it('0원 모임 → "무료" (단위를 안 붙인다 — "무료원" 금지)', () => {
    expect(formatPaidAmountWithUnit(0, 0)).toBe('무료')
  })

  it('유료 모임 → 숫자 + "원"', () => {
    expect(formatPaidAmountWithUnit(12000, 12000)).toBe('12,000원')
    expect(formatPaidAmountWithUnit(6000, 12000)).toBe('6,000원')
  })

  // 🔴 회귀 방지 — 마이페이지 「신청 내역」이 이 자리다.
  // 2026-10-06 중복환불 장부 정리로 결제액이 0인 유료 모임 신청 건이 prod에 있다.
  it('🔴 유료 모임인데 결제액이 0 → "무료"가 아니라 "0원"', () => {
    expect(formatPaidAmountWithUnit(0, 12000)).toBe('0원')
  })
})

describe('formatFee는 안 바뀐다 (운영자·정산·환불용)', () => {
  it('0 → "0"', () => {
    expect(formatFee(0)).toBe('0')
  })
})

// ─── getDaysUntil ───

describe('getDaysUntil', () => {
  it('같은 날 → 0', () => {
    expect(getDaysUntil('2026-03-27', '2026-03-27')).toBe(0)
  })

  it('3일 후 → 3', () => {
    expect(getDaysUntil('2026-03-30', '2026-03-27')).toBe(3)
  })

  it('1일 전 → -1', () => {
    expect(getDaysUntil('2026-03-26', '2026-03-27')).toBe(-1)
  })

  it('월 경계 (3월 → 4월)', () => {
    expect(getDaysUntil('2026-04-01', '2026-03-27')).toBe(5)
  })

  it('연 경계 (12월 → 1월)', () => {
    expect(getDaysUntil('2027-01-01', '2026-12-31')).toBe(1)
  })
})

// ─── getMeetingTiming ───

describe('getMeetingTiming', () => {
  it('모임이 미래 → "before_or_today"', () => {
    expect(getMeetingTiming('2026-03-20', '2026-03-15')).toBe('before_or_today')
  })

  it('모임이 오늘 → "before_or_today"', () => {
    expect(getMeetingTiming('2026-03-15', '2026-03-15')).toBe('before_or_today')
  })

  it('모임이 과거 → "after"', () => {
    expect(getMeetingTiming('2026-03-14', '2026-03-15')).toBe('after')
  })
})

// ─── getButtonState (PRD §6-2) ───

describe('getButtonState', () => {
  const TODAY = '2026-03-15'
  const FUTURE = '2026-03-20'
  const PAST = '2026-03-10'

  describe('모임 전/당일', () => {
    it('미신청 + 여유 → register', () => {
      expect(getButtonState(FUTURE, TODAY, false, false)).toEqual({ type: 'register' })
    })

    it('미신청 + 정원 초과 + 미대기 → join_waitlist', () => {
      expect(getButtonState(FUTURE, TODAY, false, true, false)).toEqual({ type: 'join_waitlist' })
    })

    it('신청완료 → cancel', () => {
      expect(getButtonState(FUTURE, TODAY, true, false)).toEqual({ type: 'cancel' })
    })

    it('신청완료 + 정원 초과 → cancel (신청자는 취소 가능)', () => {
      expect(getButtonState(FUTURE, TODAY, true, true)).toEqual({ type: 'cancel' })
    })

    it('당일 + 미신청 + 여유 → register', () => {
      expect(getButtonState(TODAY, TODAY, false, false)).toEqual({ type: 'register' })
    })

    it('당일 + 신청완료 → cancel', () => {
      expect(getButtonState(TODAY, TODAY, true, false)).toEqual({ type: 'cancel' })
    })
  })

  describe('대기 상태', () => {
    it('대기 중 → waitlist_cancel', () => {
      expect(getButtonState(FUTURE, TODAY, false, true, true)).toEqual({ type: 'waitlist_cancel' })
    })

    it('대기 중 + 정원 여유 → waitlist_cancel (이미 대기 신청한 상태)', () => {
      expect(getButtonState(FUTURE, TODAY, false, false, true)).toEqual({ type: 'waitlist_cancel' })
    })
  })

  describe('입금 대기 상태 (계좌이체)', () => {
    it('입금 대기 → pending_transfer', () => {
      expect(getButtonState(FUTURE, TODAY, false, false, false, true)).toEqual({ type: 'pending_transfer' })
    })

    it('입금 대기 + 정원 초과 → pending_transfer (이미 신청)', () => {
      expect(getButtonState(FUTURE, TODAY, false, true, false, true)).toEqual({ type: 'pending_transfer' })
    })

    it('confirmed 우선 → cancel (confirmed > pending_transfer)', () => {
      expect(getButtonState(FUTURE, TODAY, true, false, false, true)).toEqual({ type: 'cancel' })
    })

    it('모임 후 + 입금 대기 → none (과거 모임)', () => {
      expect(getButtonState(PAST, TODAY, false, false, false, true)).toEqual({ type: 'none' })
    })
  })

  describe('모임 후', () => {
    it('신청완료 → attended', () => {
      expect(getButtonState(PAST, TODAY, true, false)).toEqual({ type: 'attended' })
    })

    it('미신청 → none', () => {
      expect(getButtonState(PAST, TODAY, false, false)).toEqual({ type: 'none' })
    })
  })
})
