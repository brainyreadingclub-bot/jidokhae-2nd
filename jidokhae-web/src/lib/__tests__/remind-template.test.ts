import { describe, it, expect } from 'vitest'
import {
  REMIND_TEMPLATE_VARIABLES,
  buildRemindVariables,
  pickRemindTemplate,
  type RemindVariant,
} from '@/lib/remind-template'

const FULL_ENV = {
  SOLAPI_TEMPLATE_REMIND: 'TPL_DEFAULT',
  SOLAPI_TEMPLATE_REMIND_DISCUSSION: 'TPL_DISCUSSION',
}
const ONLY_DEFAULT_ENV = { SOLAPI_TEMPLATE_REMIND: 'TPL_DEFAULT' }

describe('pickRemindTemplate — 갈래', () => {
  it('토론모임 + 토론 env → 토론 템플릿', () => {
    expect(pickRemindTemplate({ meetingType: 'discussion', env: FULL_ENV })).toEqual({
      templateCode: 'TPL_DISCUSSION',
      variant: 'discussion',
    })
  })

  it('정기모임 → 일반 템플릿', () => {
    expect(pickRemindTemplate({ meetingType: 'regular', env: FULL_ENV })).toEqual({
      templateCode: 'TPL_DEFAULT',
      variant: 'default',
    })
  })

  it.each(['workshop', 'event', null, undefined])('모르는 종류(%s)는 일반 템플릿', (meetingType) => {
    expect(pickRemindTemplate({ meetingType, env: FULL_ENV })).toEqual({
      templateCode: 'TPL_DEFAULT',
      variant: 'default',
    })
  })
})

describe('pickRemindTemplate — env가 없으면 지금 동작과 같다 (배포 순서를 안 탄다)', () => {
  it.each(['discussion', 'regular', null])('%s → SOLAPI_TEMPLATE_REMIND', (meetingType) => {
    expect(pickRemindTemplate({ meetingType, env: ONLY_DEFAULT_ENV })).toEqual({
      templateCode: 'TPL_DEFAULT',
      variant: 'default',
    })
  })

  it('빈 문자열·공백 env는 없는 것으로 본다', () => {
    for (const blank of ['', '  ']) {
      const env = { ...ONLY_DEFAULT_ENV, SOLAPI_TEMPLATE_REMIND_DISCUSSION: blank }
      expect(pickRemindTemplate({ meetingType: 'discussion', env }).variant).toBe('default')
    }
  })

  it('기본 env마저 없으면 종전처럼 undefined를 그대로 넘긴다', () => {
    expect(pickRemindTemplate({ meetingType: 'regular', env: {} }).templateCode).toBeUndefined()
  })
})

describe('템플릿 변수 목록 — 승인본과 한 글자까지 고정', () => {
  it('일반(MEETING_REMIND_V2)', () => {
    expect(REMIND_TEMPLATE_VARIABLES.default).toEqual([
      '#{회원명}',
      '#{모임일시}',
      '#{장소}',
      '#{참가비}',
      '#{결제상태}',
      '#{모임ID}',
    ])
  })

  it('토론(MEETING_REMIND_DISCUSSION_V2) — #{모임명}이 있다', () => {
    expect(REMIND_TEMPLATE_VARIABLES.discussion).toEqual([
      '#{회원명}',
      '#{모임명}',
      '#{모임일시}',
      '#{장소}',
      '#{참가비}',
      '#{결제상태}',
      '#{모임ID}',
    ])
  })

  const built = buildRemindVariables({
    displayName: '초록고래',
    meetingTitle: '10월 토론모임',
    dateTime: '10월 27일(화) 19:30',
    location: '우연히책방',
    fee: '20,000',
    paymentStatus: '결제완료',
    meetingId: 'm-1',
  })

  it.each(Object.keys(REMIND_TEMPLATE_VARIABLES) as RemindVariant[])(
    '%s 템플릿의 변수가 하나도 빠지지 않고 값이 비지 않는다',
    (variant) => {
      for (const key of REMIND_TEMPLATE_VARIABLES[variant]) {
        expect(built, key).toHaveProperty([key])
        expect(built[key], key).not.toBe('')
      }
    },
  )

  it('넘기는 키는 정확히 7개 (모든 템플릿의 합집합)', () => {
    const union = new Set(Object.values(REMIND_TEMPLATE_VARIABLES).flat())
    expect(Object.keys(built).sort()).toEqual([...union].sort())
  })
})
