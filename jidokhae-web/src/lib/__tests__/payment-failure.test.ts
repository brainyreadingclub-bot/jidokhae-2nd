import { describe, it, expect, beforeEach, vi } from 'vitest'

// vi.mock 팩토리는 import보다 먼저 평가되므로 vi.hoisted로 핸들을 먼저 만든다.
const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  createServiceClient: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createServiceClient: mocks.createServiceClient,
}))

import { recordDuplicateCallBlocked, safeUuid, USER_AGENT_MAX } from '@/lib/payment-failure'

/**
 * 실패 원장의 제1원칙은 "행을 잃지 않는 것"이다.
 * UUID 컬럼에 이상한 값이 들어가 INSERT가 통째로 거절되면, 하필 가장 수상한
 * 요청의 기록이 사라진다. 그 자리를 막는 가드의 테스트.
 */
describe('safeUuid — 이상한 값 때문에 기록 자체를 잃지 않는다', () => {
  it('정상 UUID는 그대로 통과한다', () => {
    expect(safeUuid('20425c26-4b1e-4b3a-9f0c-1a2b3c4d5e6f')).toEqual({
      uuid: '20425c26-4b1e-4b3a-9f0c-1a2b3c4d5e6f',
      note: null,
    })
  })

  it('대문자 UUID도 통과한다 (Postgres가 정규화한다)', () => {
    expect(safeUuid('20425C26-4B1E-4B3A-9F0C-1A2B3C4D5E6F').uuid).not.toBeNull()
  })

  it('UUID가 아니면 null로 돌리고 원문을 note에 남긴다 — 버리지 않는다', () => {
    const result = safeUuid('not-a-uuid')
    expect(result.uuid).toBeNull()
    expect(result.note).toContain('not-a-uuid')
  })

  it('SQL/제어문자가 섞인 긴 입력도 잘라서 남긴다', () => {
    const result = safeUuid('x'.repeat(500))
    expect(result.uuid).toBeNull()
    expect(result.note!.length).toBeLessThan(120)
  })

  it('없는 값(null/undefined/빈 문자열)은 조용히 null — 잡음을 남기지 않는다', () => {
    expect(safeUuid(null)).toEqual({ uuid: null, note: null })
    expect(safeUuid(undefined)).toEqual({ uuid: null, note: null })
    expect(safeUuid('')).toEqual({ uuid: null, note: null })
  })
})

/**
 * 「막아낸 중복 호출」 기록 (2026-10-06 관찰계획 ①③).
 *
 * 이 기록의 유일한 목적은 **누가 두 번 보내는지**를 남기는 것이다. 그래서 두 가지만
 * 지키면 된다 — (1) `ua=`가 알아볼 수 있는 길이로 남는가, (2) 기록이 실패해도
 * 결제 흐름을 막지 않는가(= 절대 throw 안 함).
 */
const MEETING_ID = '11111111-1111-4111-8111-111111111111'
const USER_ID = '22222222-2222-4222-8222-222222222222'
const PAYMENT_ID = 'jdkh-11111111-22222222-1700000000000'
/** 카카오톡 인앱 브라우저 UA — 가르고 싶은 단서(`KAKAOTALK`)가 맨 뒤에 있다 */
const KAKAO_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.5.0'

describe('recordDuplicateCallBlocked — 막아낸 사실을 남긴다', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.insert.mockResolvedValue({ error: null })
    mocks.createServiceClient.mockImplementation(() => ({
      from: () => ({ insert: mocks.insert }),
    }))
  })

  const lastInsert = () => mocks.insert.mock.calls[0][0] as Record<string, unknown>

  it('stage는 duplicate_call_blocked — 사고 단계와 섞이지 않는다', async () => {
    await recordDuplicateCallBlocked({
      source: 'confirm',
      paymentId: PAYMENT_ID,
      meetingId: MEETING_ID,
      userId: USER_ID,
      userAgent: KAKAO_UA,
    })

    expect(mocks.insert).toHaveBeenCalledTimes(1)
    expect(lastInsert()).toMatchObject({
      source: 'confirm',
      stage: 'duplicate_call_blocked',
      payment_id: PAYMENT_ID,
      meeting_id: MEETING_ID,
      user_id: USER_ID,
    })
  })

  it('카카오톡 인앱 UA는 KAKAOTALK까지 온전히 남는다 — 이게 핵심 단서다', async () => {
    await recordDuplicateCallBlocked({
      source: 'confirm',
      paymentId: PAYMENT_ID,
      userAgent: KAKAO_UA,
    })

    const detail = String(lastInsert().detail)
    expect(detail).toBe(`ua=${KAKAO_UA}`)
    expect(detail).toContain('KAKAOTALK')
  })

  it('웹훅 경로도 같은 단계로 남는다 — 한쪽만 보면 범인을 놓친다', async () => {
    await recordDuplicateCallBlocked({
      source: 'webhook',
      paymentId: PAYMENT_ID,
      userAgent: 'PortOne-Webhook/2024-04-25',
    })

    expect(lastInsert()).toMatchObject({
      source: 'webhook',
      stage: 'duplicate_call_blocked',
      detail: 'ua=PortOne-Webhook/2024-04-25',
    })
  })

  it(`UA가 지나치게 길면 ${USER_AGENT_MAX}자로 자른다 — detail을 잡아먹지 않게`, async () => {
    await recordDuplicateCallBlocked({
      source: 'confirm',
      paymentId: PAYMENT_ID,
      userAgent: 'A'.repeat(1000),
    })

    expect(String(lastInsert().detail)).toBe(`ua=${'A'.repeat(USER_AGENT_MAX)}`)
  })

  it('UA가 없어도 기록은 남는다 — 기록을 잃는 쪽이 더 나쁘다', async () => {
    await recordDuplicateCallBlocked({
      source: 'confirm',
      paymentId: PAYMENT_ID,
      userAgent: null,
    })

    expect(lastInsert().detail).toBe('ua=(없음)')
  })

  it('🔴 기록이 실패해도 throw하지 않는다 — 기록 실패가 결제를 막으면 더 큰 사고다', async () => {
    mocks.createServiceClient.mockImplementation(() => {
      throw new Error('supabase down')
    })

    await expect(
      recordDuplicateCallBlocked({
        source: 'confirm',
        paymentId: PAYMENT_ID,
        userAgent: KAKAO_UA,
      }),
    ).resolves.toBeUndefined()
  })
})
