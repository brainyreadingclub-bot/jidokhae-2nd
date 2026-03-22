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

    it('미신청 + 정원 초과 → full', () => {
      expect(getButtonState(FUTURE, TODAY, false, true)).toEqual({ type: 'full' })
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

  describe('모임 후', () => {
    it('신청완료 → attended', () => {
      expect(getButtonState(PAST, TODAY, true, false)).toEqual({ type: 'attended' })
    })

    it('미신청 → none', () => {
      expect(getButtonState(PAST, TODAY, false, false)).toEqual({ type: 'none' })
    })
  })
})
