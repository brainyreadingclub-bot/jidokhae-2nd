import { describe, it, expect, beforeEach, vi } from 'vitest'

// vi.mock 팩토리는 import보다 먼저 평가되므로 vi.hoisted로 핸들을 먼저 만든다.
const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  createServiceClient: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createServiceClient: mocks.createServiceClient,
}))

import {
  APP_EVENTS,
  buildAppEventRow,
  gaEventName,
  isAppEventName,
  isForbiddenPropKey,
  recordAppEvent,
  sanitizeEventProps,
  PROPS_MAX_KEYS,
  PROPS_MAX_STRING,
  type AppEventName,
} from '@/lib/app-events'

const U = '20425c26-4b1e-4b3a-9f0c-1a2b3c4d5e6f'
const M = '0b6f3c1e-1234-4abc-9def-0123456789ab'

describe('이벤트 이름 목록', () => {
  it('모든 이름이 「화면.행동」 형식이다 — SQL CHECK와 같은 규칙', () => {
    for (const name of APP_EVENTS) {
      expect(name).toMatch(/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/)
    }
  })
  it('목록 밖 이름은 아니라고 답한다', () => {
    expect(isAppEventName('meet.view_item_list')).toBe(true)
    expect(isAppEventName('meet.view_item_lists')).toBe(false)
    expect(isAppEventName('')).toBe(false)
  })
  it('목록 밖 이름은 tsc가 막는다 (아래 줄의 @ts-expect-error가 「오류가 없다」로 깨지면 타입이 풀린 것)', () => {
    // @ts-expect-error — 목록에 없는 이름
    const row = buildAppEventRow({ event: 'home.not_listed', userId: U })
    expect(row).toBeNull()
  })
  it('GA 이름 = 점 뒤 부분', () => {
    expect(gaEventName('meet.view_item_list')).toBe('view_item_list')
    expect(gaEventName('registration.sign_up_meeting')).toBe('sign_up_meeting')
  })
})

describe('sanitizeEventProps — 실명·전화·결제 정보를 지운다', () => {
  it('허용 값(문자열·숫자·참거짓)은 그대로 둔다', () => {
    expect(
      sanitizeEventProps({ pos: 2, payment_method: 'transfer', amount: 10000, result: 'pending_transfer', ok: true }),
    ).toEqual({ pos: 2, payment_method: 'transfer', amount: 10000, result: 'pending_transfer', ok: true })
  })
  it('개인정보·결제 식별자로 읽히는 키는 지운다', () => {
    const out = sanitizeEventProps({
      real_name: '홍길동',
      name: '홍길동',
      nickname: '초록고래',
      phone: 'x',
      phoneNumber: 'x',
      email: 'x',
      payment_id: 'jdkh-1',
      paymentId: 'jdkh-1',
      tx_id: 'x',
      txId: 'x',
      card: 'x',
      card_number: 'x',
      account: 'x',
      bank_account: 'x',
      depositor_name: 'x',
      tel: 'x',
      pos: 1,
    })
    expect(out).toEqual({ pos: 1 })
  })
  it('isForbiddenPropKey — payment_method(수단 종류)는 막지 않는다', () => {
    expect(isForbiddenPropKey('payment_method')).toBe(false)
    expect(isForbiddenPropKey('meeting_type')).toBe(false)
    expect(isForbiddenPropKey('Real-Name')).toBe(true)
  })
  it('값이 이메일·전화번호처럼 생겼으면 키가 무엇이든 지운다', () => {
    expect(sanitizeEventProps({ note: 'a@b.com', memo: '010-1234-5678', memo2: '01012345678', ok: 'x' })).toEqual({
      ok: 'x',
    })
  })
  it('객체·배열·null·무한수는 버린다', () => {
    expect(
      sanitizeEventProps({ a: { b: 1 }, c: [1], d: null, e: undefined, f: NaN, g: Infinity, h: 3 }),
    ).toEqual({ h: 3 })
  })
  it('키 개수·문자열 길이를 자른다', () => {
    const many = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`k${i}`, i]))
    expect(Object.keys(sanitizeEventProps(many))).toHaveLength(PROPS_MAX_KEYS)
    expect((sanitizeEventProps({ s: 'x'.repeat(500) }).s as string).length).toBe(PROPS_MAX_STRING)
  })
  it('이상한 키 이름(대문자 시작·공백·너무 긴 것)은 버린다', () => {
    expect(sanitizeEventProps({ Pos: 1, 'a b': 1, ['k'.repeat(41)]: 1, ok: 1 })).toEqual({ ok: 1 })
  })
  it('입력이 없거나 객체가 아니면 빈 객체', () => {
    expect(sanitizeEventProps(undefined)).toEqual({})
    expect(sanitizeEventProps(null)).toEqual({})
    expect(sanitizeEventProps([1, 2] as unknown as Record<string, unknown>)).toEqual({})
  })
})

describe('buildAppEventRow', () => {
  it('정상 입력이면 한 줄', () => {
    expect(
      buildAppEventRow({ event: 'home_upcoming.meeting_click', userId: U, meetingId: M, props: { pos: 1 } }),
    ).toEqual({ event: 'home_upcoming.meeting_click', user_id: U, meeting_id: M, props: { pos: 1 } })
  })
  it('목록 밖 이름은 null — 타입을 우회해 들어와도 기록하지 않는다', () => {
    expect(buildAppEventRow({ event: 'evil.event' as string as AppEventName, userId: U })).toBeNull()
  })
  it('UUID 꼴이 아닌 모임·회원 id는 비우고 이벤트는 남긴다', () => {
    expect(buildAppEventRow({ event: 'meet.view_item_list', userId: 'x', meetingId: 'abc' })).toEqual({
      event: 'meet.view_item_list',
      user_id: null,
      meeting_id: null,
      props: {},
    })
  })
})

describe('recordAppEvent — 절대 throw하지 않는다', () => {
  beforeEach(() => {
    mocks.insert.mockReset()
    mocks.createServiceClient.mockReset()
    mocks.createServiceClient.mockReturnValue({ from: () => ({ insert: mocks.insert }) })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('정화된 한 줄을 app_events에 넣는다', async () => {
    mocks.insert.mockResolvedValue({ error: null })
    await recordAppEvent({
      event: 'registration.sign_up_meeting',
      userId: U,
      meetingId: M,
      props: { payment_method: 'transfer', amount: 0, phone: '010-0000-0000' },
    })
    expect(mocks.insert).toHaveBeenCalledWith({
      event: 'registration.sign_up_meeting',
      user_id: U,
      meeting_id: M,
      props: { payment_method: 'transfer', amount: 0 },
    })
  })
  it('목록 밖 이름은 DB를 부르지도 않는다', async () => {
    await recordAppEvent({ event: 'evil.event' as string as AppEventName, userId: U })
    expect(mocks.createServiceClient).not.toHaveBeenCalled()
  })
  it('표가 없어서(42P01) insert가 실패해도 조용히 끝난다', async () => {
    mocks.insert.mockResolvedValue({ error: { message: 'relation "public.app_events" does not exist' } })
    await expect(recordAppEvent({ event: 'meet.view_item_list', userId: U })).resolves.toBeUndefined()
  })
  it('네트워크 예외·클라이언트 생성 실패도 삼킨다', async () => {
    mocks.insert.mockRejectedValue(new Error('fetch failed'))
    await expect(recordAppEvent({ event: 'meet.view_item_list', userId: U })).resolves.toBeUndefined()
    mocks.createServiceClient.mockImplementation(() => {
      throw new Error('no env')
    })
    await expect(recordAppEvent({ event: 'meet.view_item_list', userId: U })).resolves.toBeUndefined()
  })
})
