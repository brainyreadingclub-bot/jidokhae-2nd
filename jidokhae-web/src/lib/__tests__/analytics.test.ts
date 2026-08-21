import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { META_EVENT_MAP, toMetaParams, trackEvent } from '@/lib/analytics'
import { normalizeKRPhone, hashForMeta } from '@/lib/meta-capi'

type Call = unknown[]

function installFakeWindow() {
  const gtagCalls: Call[] = []
  const fbqCalls: Call[] = []
  ;(globalThis as unknown as { window?: unknown }).window = {
    gtag: (...args: Call) => gtagCalls.push(args),
    fbq: (...args: Call) => fbqCalls.push(args),
  }
  return { gtagCalls, fbqCalls }
}

describe('trackEvent — GA/메타 이중 발화', () => {
  let calls: ReturnType<typeof installFakeWindow>

  beforeEach(() => {
    calls = installFakeWindow()
  })

  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window
  })

  it('매핑된 이벤트는 GA와 메타 양쪽으로 나간다', () => {
    trackEvent('purchase', { currency: 'KRW', value: 12000, meeting_id: 'm-1' })

    expect(calls.gtagCalls).toHaveLength(1)
    expect(calls.fbqCalls).toHaveLength(1)
    expect(calls.fbqCalls[0][1]).toBe('Purchase')
  })

  it('매핑 없는 이벤트는 GA로만 나간다', () => {
    trackEvent('purchase_failed', { meeting_id: 'm-1' })

    expect(calls.gtagCalls).toHaveLength(1)
    expect(calls.fbqCalls).toHaveLength(0)
  })

  it('eventId를 넘기면 메타에 eventID로 전달된다 (서버와 dedup)', () => {
    trackEvent('purchase', { currency: 'KRW' }, { eventId: 'jdkh-abc-123' })

    expect(calls.fbqCalls[0][3]).toEqual({ eventID: 'jdkh-abc-123' })
  })

  it('eventId가 없으면 4번째 인자는 undefined', () => {
    trackEvent('purchase', { currency: 'KRW' })

    expect(calls.fbqCalls[0][3]).toBeUndefined()
  })

  it('skipMeta면 GA만 나간다 — 첫 진입 PageView 2중 집계 방지', () => {
    trackEvent('page_view', { page_path: '/' }, { skipMeta: true })

    expect(calls.gtagCalls).toHaveLength(1)
    expect(calls.fbqCalls).toHaveLength(0)
  })

  it('skipMeta가 아니면 SPA 이동 PageView가 메타로 나간다', () => {
    trackEvent('page_view', { page_path: '/policy/terms' }, { skipMeta: false })

    expect(calls.fbqCalls).toHaveLength(1)
    expect(calls.fbqCalls[0][1]).toBe('PageView')
  })
})

describe('META_EVENT_MAP', () => {
  it('결제·가입 전환은 메타 표준 이벤트로 매핑된다', () => {
    expect(META_EVENT_MAP.purchase).toBe('Purchase')
    expect(META_EVENT_MAP.sign_up).toBe('CompleteRegistration')
    expect(META_EVENT_MAP.begin_checkout).toBe('InitiateCheckout')
  })

  it('내부 지표는 픽셀로 나가지 않는다 (광고 최적화 신호 오염 방지)', () => {
    expect(META_EVENT_MAP.purchase_failed).toBeUndefined()
    expect(META_EVENT_MAP.refund).toBeUndefined()
    expect(META_EVENT_MAP.ask_strip_view).toBeUndefined()
  })
})

describe('toMetaParams', () => {
  it('금액·통화·모임ID를 메타 키로 변환한다', () => {
    expect(
      toMetaParams({ currency: 'KRW', value: 12000, meeting_id: 'm-1' }),
    ).toEqual({
      currency: 'KRW',
      value: 12000,
      content_ids: ['m-1'],
      content_type: 'product',
    })
  })

  it('메타가 안 읽는 내부 파라미터는 버린다', () => {
    const result = toMetaParams({ registration_type: 'waitlisted', reason: 'full' })
    expect(result).toEqual({})
  })

  it('value가 없으면 value 키 자체를 넣지 않는다', () => {
    const result = toMetaParams({ currency: 'KRW', value: undefined })
    expect(result).toEqual({ currency: 'KRW' })
    expect('value' in result).toBe(false)
  })

  it('params가 없어도 빈 객체를 돌려준다', () => {
    expect(toMetaParams(undefined)).toEqual({})
  })
})

describe('normalizeKRPhone', () => {
  it('국내 휴대폰을 국가코드 포함 숫자열로 바꾼다', () => {
    expect(normalizeKRPhone('01012345678')).toBe('821012345678')
    expect(normalizeKRPhone('010-1234-5678')).toBe('821012345678')
  })

  it('이미 국가코드가 붙어 있으면 그대로 둔다', () => {
    expect(normalizeKRPhone('+82 10-1234-5678')).toBe('821012345678')
  })

  it('형식을 못 맞추면 null — 틀린 값으로 매칭률을 떨어뜨리지 않는다', () => {
    expect(normalizeKRPhone(null)).toBeNull()
    expect(normalizeKRPhone('')).toBeNull()
    expect(normalizeKRPhone('1234')).toBeNull()
    expect(normalizeKRPhone('abc')).toBeNull()
  })
})

describe('hashForMeta', () => {
  it('소문자·공백 제거 후 SHA-256 hex를 만든다', () => {
    expect(hashForMeta('  ABC  ')).toBe(hashForMeta('abc'))
    expect(hashForMeta('abc')).toHaveLength(64)
  })
})
