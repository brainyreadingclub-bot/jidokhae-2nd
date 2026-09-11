import { describe, it, expect } from 'vitest'
import {
  classifyIdLookup,
  parsePaymentId,
  uuidPrefixRange,
  type PrefixLookupResult,
} from '@/lib/payment-id'

/**
 * 2026-09-10 고아 결제 사고 회귀 테스트.
 *
 * 두 가지를 지킨다.
 *  1. UUID 앞 8자로 만든 구간이 **그 UUID를 실제로 덮는다** (= 조회가 행을 찾아낸다)
 *  2. 조회 실패가 **조용히 성공/대상없음으로 둔갑하지 않는다**
 */

describe('parsePaymentId', () => {
  it('정상 형식에서 두 prefix를 뽑는다', () => {
    // 사고 당사자의 실제 paymentId 형식
    const parsed = parsePaymentId('jdkh-20425c26-c22d8636-1788764839332')
    expect(parsed).toEqual({ meetingId8: '20425c26', userId8: 'c22d8636' })
  })

  it('타임스탬프 뒤에 무엇이 붙어도 앞 세 칸만 본다', () => {
    expect(parsePaymentId('jdkh-20425c26-c22d8636-1788764839332-retry')).toEqual({
      meetingId8: '20425c26',
      userId8: 'c22d8636',
    })
  })

  it.each([
    ['우리 접두사가 아님', 'payment_0b80f8c4-x-y-1770299350934'],
    ['칸이 모자람', 'jdkh-20425c26-c22d8636'],
    ['prefix가 8자가 아님', 'jdkh-20425c2-c22d8636-1788764839332'],
    ['hex가 아닌 문자', 'jdkh-20425c2g-c22d8636-1788764839332'],
    ['대문자 hex (우리는 소문자로만 채번한다)', 'jdkh-20425C26-c22d8636-1788764839332'],
    ['LIKE 와일드카드 주입 시도', 'jdkh-%-c22d8636-1788764839332'],
    ['빈 문자열', ''],
  ])('형식이 깨지면 null — %s', (_label, input) => {
    expect(parsePaymentId(input)).toBeNull()
  })
})

describe('uuidPrefixRange — 구간이 실제로 그 행을 덮는가', () => {
  // Postgres uuid 비교는 16바이트 memcmp이고, 표준 표기는 그 바이트를 순서대로
  // hex로 적은 것이다. 따라서 uuid 정렬 = 표기 문자열 사전순.
  // 아래 테스트는 그 사전순 포함 관계를 직접 검사한다.
  const covers = (lo: string, hi: string, uuid: string) => lo <= uuid && uuid <= hi

  it.each([
    ['사고 당사자 모임 UUID', '20425c26-4b1e-4b3a-9f0c-1a2b3c4d5e6f'],
    ['0으로 끝나는 최소 UUID', '20425c26-0000-0000-0000-000000000000'],
    ['f로 끝나는 최대 UUID', '20425c26-ffff-ffff-ffff-ffffffffffff'],
    ['중간값', '20425c26-89ab-cdef-0123-456789abcdef'],
  ])('prefix 구간이 %s 를 포함한다', (_label, uuid) => {
    const prefix8 = uuid.slice(0, 8)
    const range = uuidPrefixRange(prefix8)
    expect(range).not.toBeNull()
    expect(covers(range!.lo, range!.hi, uuid)).toBe(true)
  })

  it('prefix가 다른 UUID는 구간 밖이다 — 남의 모임을 끌어오지 않는다', () => {
    const range = uuidPrefixRange('20425c26')!
    // 바로 앞/뒤 prefix
    expect(covers(range.lo, range.hi, '20425c25-ffff-ffff-ffff-ffffffffffff')).toBe(false)
    expect(covers(range.lo, range.hi, '20425c27-0000-0000-0000-000000000000')).toBe(false)
    // 전혀 다른 UUID
    expect(covers(range.lo, range.hi, 'c22d8636-0000-0000-0000-000000000000')).toBe(false)
  })

  it('경계값 prefix (00000000 / ffffffff)도 자기 자신을 덮는다', () => {
    const lowest = uuidPrefixRange('00000000')!
    expect(covers(lowest.lo, lowest.hi, '00000000-0000-0000-0000-000000000000')).toBe(true)
    const highest = uuidPrefixRange('ffffffff')!
    expect(covers(highest.lo, highest.hi, 'ffffffff-ffff-ffff-ffff-ffffffffffff')).toBe(true)
  })

  it('hex 8자가 아니면 null — 엉뚱한 구간을 만들지 않는다', () => {
    expect(uuidPrefixRange('20425c2')).toBeNull()
    expect(uuidPrefixRange('20425c266')).toBeNull()
    expect(uuidPrefixRange('20425c2g')).toBeNull()
    expect(uuidPrefixRange('20425C26')).toBeNull()
    expect(uuidPrefixRange('%')).toBeNull()
  })
})

describe('classifyIdLookup — 조회 실패가 조용히 둔갑하지 않는다', () => {
  const found = (id: string): PrefixLookupResult => ({ data: [{ id }], error: null })
  const empty: PrefixLookupResult = { data: [], error: null }

  const MEETING = '20425c26-4b1e-4b3a-9f0c-1a2b3c4d5e6f'
  const USER = 'c22d8636-1111-2222-3333-444455556666'

  it('둘 다 찾으면 resolved', () => {
    expect(classifyIdLookup(found(MEETING), found(USER))).toEqual({
      kind: 'resolved',
      meetingId: MEETING,
      userId: USER,
    })
  })

  it('🔴 42883(uuid LIKE text) 응답은 query_failed다 — 대상 없음이 아니다', () => {
    // 2026-09-10 사고에서 prod가 실제로 돌려준 모양: data는 null, error에 42883.
    // 옛 코드는 error를 버리고 `!data?.length`만 봐서 이걸 "대상 없음"으로 읽었다.
    const broken: PrefixLookupResult = {
      data: null,
      error: { code: '42883', message: 'operator does not exist: uuid ~~ unknown' },
    }
    const outcome = classifyIdLookup(broken, broken)

    expect(outcome.kind).toBe('query_failed')
    expect(outcome.kind).not.toBe('not_found')
    expect(outcome.kind).not.toBe('resolved')
    // 원문 에러가 보존돼야 payment_failures에 남길 것이 있다
    expect(outcome.kind === 'query_failed' && outcome.detail).toContain('42883')
  })

  it('한쪽만 실패해도 query_failed — 반쪽 성공을 성공으로 치지 않는다', () => {
    const outcome = classifyIdLookup(found(MEETING), {
      data: null,
      error: { code: '42883', message: 'operator does not exist: uuid ~~ unknown' },
    })
    expect(outcome.kind).toBe('query_failed')
  })

  it('error가 없어도 data가 null이면 query_failed — 정상 응답은 빈 배열이다', () => {
    const outcome = classifyIdLookup({ data: null, error: null }, found(USER))
    expect(outcome.kind).toBe('query_failed')
  })

  it('🔴 prefix에 두 행이 걸리면 ambiguous — 먼저 나온 행을 조용히 고르지 않는다', () => {
    // UUID 앞 8자만 쓰므로 충돌이 원리적으로 가능하다.
    // 옛 코드는 `.limit(1)`이라 충돌을 알아챌 수조차 없었고, 알아챘더라도
    // 첫 행을 골랐을 것이다 — 그러면 남의 명의로 신청이 만들어진다.
    const twoProfiles: PrefixLookupResult = {
      data: [{ id: USER }, { id: 'c22d8636-9999-9999-9999-999999999999' }],
      error: null,
    }
    const outcome = classifyIdLookup(found(MEETING), twoProfiles)

    expect(outcome.kind).toBe('ambiguous')
    expect(outcome.kind).not.toBe('resolved')
    expect(outcome.kind === 'ambiguous' && outcome.detail).toContain('profiles')
  })

  it('충돌은 "없음"보다 먼저 판정한다 — 한쪽이 비어도 충돌 쪽을 알려준다', () => {
    const twoMeetings: PrefixLookupResult = {
      data: [{ id: MEETING }, { id: '20425c26-8888-8888-8888-888888888888' }],
      error: null,
    }
    const outcome = classifyIdLookup(twoMeetings, empty)
    expect(outcome.kind).toBe('ambiguous')
  })

  it('조회 자체가 실패하면 충돌 판정보다 먼저 query_failed로 끝난다', () => {
    const twoMeetings: PrefixLookupResult = {
      data: [{ id: MEETING }, { id: '20425c26-8888-8888-8888-888888888888' }],
      error: null,
    }
    const outcome = classifyIdLookup(twoMeetings, {
      data: null,
      error: { code: '42883', message: 'operator does not exist: uuid ~~ unknown' },
    })
    expect(outcome.kind).toBe('query_failed')
  })

  it('조회 성공 + 0행이면 not_found (query_failed와 구분된다)', () => {
    const outcome = classifyIdLookup(empty, found(USER))
    expect(outcome.kind).toBe('not_found')
    expect(outcome.kind === 'not_found' && outcome.detail).toContain('meeting')
  })

  it('둘 다 0행이면 not_found에 둘 다 적힌다', () => {
    const outcome = classifyIdLookup(empty, empty)
    expect(outcome.kind).toBe('not_found')
    expect(outcome.kind === 'not_found' && outcome.detail).toContain('meeting')
    expect(outcome.kind === 'not_found' && outcome.detail).toContain('user')
  })
})
