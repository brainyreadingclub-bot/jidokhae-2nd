import { describe, it, expect } from 'vitest'
import {
  MEETING_KINDS,
  MEETING_KIND_OPTIONS,
  getDateRowKindTag,
  getMeetSection,
  getMeetingKindLabel,
  getMeetingKindShortLabel,
  getRefundPolicy,
  isMeetingKind,
} from '@/lib/meeting-kinds'
import {
  calculateRefundByType,
  getRefundRuleTextByType,
  getRefundScheduleByType,
} from '@/lib/refund'
import { isAllowedCardAmount, isStaffDiscountableMeetingType } from '@/lib/pricing'
import { isAskEligibleMeeting } from '@/lib/asks-pure'
import { canApplyToMeeting, countsAsRegularAttendance } from '@/lib/discussion-eligibility'

// 기준일 2026-11-01, 모임일 = 기준일 + N일
const TODAY = '2026-11-01'
const MEETING = '2026-11-20' // 19일 전

describe('종류 규칙표 — 2026-10-16 결정', () => {
  it('선택지는 4개, 순서는 정기·토론·작업실·별책부록', () => {
    expect(MEETING_KIND_OPTIONS).toEqual(['regular', 'discussion', 'workshop', 'event'])
    expect(MEETING_KIND_OPTIONS.map((k) => MEETING_KINDS[k].label)).toEqual([
      '정기모임', '토론모임', '작업실', '별책부록',
    ])
  })

  it('event의 화면 이름은 「별책부록」', () => {
    expect(getMeetingKindLabel('event')).toBe('별책부록')
    expect(getMeetingKindShortLabel('event')).toBe('별책부록')
    expect(getMeetingKindShortLabel('workshop')).toBe('작업실')
    expect(getMeetingKindShortLabel('regular')).toBe('정기')
    expect(getMeetingKindShortLabel('discussion')).toBe('토론')
  })

  it('모임 탭 자리 — 작업실은 정기와 같은 날짜 행, 별책부록은 따로', () => {
    expect(getMeetSection('regular')).toBe('regular')
    expect(getMeetSection('workshop')).toBe('regular')
    expect(getMeetSection('discussion')).toBe('discussion')
    expect(getMeetSection('event')).toBe('event')
  })

  it('모르는 값·null은 정기로 읽는다 (구 데이터 폴백 — 환불·라벨만)', () => {
    expect(isMeetingKind('flash')).toBe(false)
    expect(isMeetingKind(null)).toBe(false)
    expect(getRefundPolicy(null)).toBe('regular')
    expect(getRefundPolicy('flash')).toBe('regular')
    expect(getMeetingKindLabel(undefined)).toBe('정기모임')
    // 객체 기본 속성 이름이 종류로 읽히면 안 된다
    expect(isMeetingKind('toString')).toBe(false)
  })
})

describe('환불 — 작업실 = 정기(3/2), 별책부록 = 토론(14/7)', () => {
  it('규칙 묶음', () => {
    expect(getRefundPolicy('regular')).toBe('regular')
    expect(getRefundPolicy('workshop')).toBe('regular')
    expect(getRefundPolicy('discussion')).toBe('discussion')
    expect(getRefundPolicy('event')).toBe('discussion')
  })

  it('작업실 — 2일 전 50%, 전날 0%', () => {
    expect(calculateRefundByType('workshop', '2026-11-03', 10000, TODAY).refundRate).toBe(50)
    expect(calculateRefundByType('workshop', '2026-11-04', 10000, TODAY).refundRate).toBe(100)
    expect(calculateRefundByType('workshop', '2026-11-02', 10000, TODAY).refundRate).toBe(0)
  })

  it('별책부록 — 14일 전 100%, 7일 전 50%, 6일 전 0%', () => {
    expect(calculateRefundByType('event', '2026-11-15', 30000, TODAY)).toMatchObject({ refundRate: 100, refundAmount: 30000 })
    expect(calculateRefundByType('event', '2026-11-14', 30000, TODAY)).toMatchObject({ refundRate: 50, refundAmount: 15000 })
    expect(calculateRefundByType('event', '2026-11-08', 30000, TODAY)).toMatchObject({ refundRate: 50 })
    expect(calculateRefundByType('event', '2026-11-07', 30000, TODAY)).toMatchObject({ refundRate: 0, refundAmount: 0 })
  })

  it('같은 날짜라도 종류에 따라 갈린다 — 5일 전', () => {
    const d = '2026-11-06'
    expect(calculateRefundByType('workshop', d, 10000, TODAY).refundRate).toBe(100)
    expect(calculateRefundByType('event', d, 10000, TODAY).refundRate).toBe(0)
  })

  it('안내 문구·단계도 같은 규칙을 읽는다', () => {
    expect(getRefundRuleTextByType('event')).toBe(getRefundRuleTextByType('discussion'))
    expect(getRefundRuleTextByType('workshop')).toBe(getRefundRuleTextByType('regular'))
    expect(getRefundScheduleByType('event', MEETING).map((s) => s.daysBefore)).toEqual([14, 7])
    expect(getRefundScheduleByType('workshop', MEETING).map((s) => s.daysBefore)).toEqual([3, 2])
  })
})

describe('혜택·자격은 새 종류에 저절로 붙지 않는다 (2026-10-16 — 누구나 신청, 스텝 할인 없음)', () => {
  it.each(['workshop', 'event'])('%s — 스텝 할인 없음, 카드는 정가만', (kind) => {
    expect(isStaffDiscountableMeetingType(kind)).toBe(false)
    expect(isAllowedCardAmount(10000, kind, 10000)).toBe(true)
    expect(isAllowedCardAmount(10000, kind, 5000)).toBe(false)
  })

  it.each(['workshop', 'event'])('%s — 누구나 신청(토론 자격 관문 없음)', (kind) => {
    expect(canApplyToMeeting(kind, { isCurator: false, hasRegularAttendance: false })).toBe(true)
  })

  it.each(['workshop', 'event'])('%s — 물어보기 알림톡 대상 아님', (kind) => {
    expect(isAskEligibleMeeting({ meeting_type: kind, status: 'active', date: '2026-10-30' }, TODAY)).toBe(false)
  })

  it.each(['workshop', 'event'])('%s 참석은 토론 참여 자격(정기 참석)으로 세지 않는다', (kind) => {
    const row = { status: 'confirmed', meetings: { meeting_type: kind, status: 'active', date: '2026-10-20' } }
    expect(countsAsRegularAttendance(row, TODAY)).toBe(false)
  })

  it('대조 — 정기는 그대로 혜택이 붙는다', () => {
    expect(isStaffDiscountableMeetingType('regular')).toBe(true)
    expect(isAskEligibleMeeting({ meeting_type: 'regular', status: 'active', date: '2026-10-30' }, TODAY)).toBe(true)
    expect(countsAsRegularAttendance(
      { status: 'confirmed', meetings: { meeting_type: 'regular', status: 'active', date: '2026-10-20' } },
      TODAY,
    )).toBe(true)
  })
})

describe('모임 탭 날짜 행 종류 표시 — 2026-10-17 결정', () => {
  it('작업실 행에만 「작업실」이 붙는다', () => {
    expect(getDateRowKindTag('workshop')).toBe('작업실')
  })

  it('정기 행에는 붙지 않는다 (null·모르는 값도 정기로 읽는다)', () => {
    expect(getDateRowKindTag('regular')).toBeNull()
    expect(getDateRowKindTag(null)).toBeNull()
    expect(getDateRowKindTag(undefined)).toBeNull()
    expect(getDateRowKindTag('lightning')).toBeNull()
  })

  it('날짜 행에 섞이는 종류 = 정기·작업실 — 둘 다 표시 규칙이 정해져 있다', () => {
    const rowKinds = MEETING_KIND_OPTIONS.filter((k) => getMeetSection(k) === 'regular')
    expect(rowKinds).toEqual(['regular', 'workshop'])
  })
})
