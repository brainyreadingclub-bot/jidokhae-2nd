/**
 * paymentId 해석 + UUID prefix 조회 — 순수 함수만.
 *
 * 왜 이 파일이 생겼나 (2026-09-10 고아 결제 사고)
 * ------------------------------------------------
 * paymentId 형식은 `jdkh-{meetingId8}-{userId8}-{timestamp}`다. 앞 8자만 들고
 * 전체 UUID를 되찾아야 하는데, 웹훅이 `.like('id', '20425c26%')`를 썼다.
 * `meetings.id`·`profiles.id`는 `uuid` 타입이고 Postgres에는 `uuid LIKE text`
 * 연산자가 없다 → 매번 `42883 operator does not exist: uuid ~~ unknown`.
 *
 * 더 나쁜 것은 그 다음이었다. 호출부가 `const { data } = ...`로 **error를 버리고**
 * `!data?.length`만 봤기 때문에 **조회 실패와 "대상 없음"이 같은 분기로 합쳐졌고**,
 * 웹훅은 200 `{"status":"ignored"}`를 돌려주며 조용히 끝냈다. M4 최초 구현부터
 * 백업 경로가 한 번도 작동한 적이 없었고, 브라우저 redirect가 끊긴 날
 * 회원 한 명의 12,000이 신청 기록 없이 떠 있었다.
 *
 * 그래서 이 파일의 두 가지 책임:
 *   1. LIKE 없이 prefix를 조회할 수 있는 **범위(range)** 를 만든다
 *   2. 조회 실패(`query_failed`)와 대상 없음(`not_found`)을 **타입 수준에서 가른다**
 *
 * 왜 RPC가 아니라 범위 조회인가
 * ------------------------------------------------
 * `id::text LIKE ...`를 하는 SECURITY DEFINER RPC도 후보였지만, 그러면 이 수정이
 * **prod SQL 실행에 묶인다** — 코드가 먼저 배포되면 RPC가 없어 웹훅이 또 죽는다.
 * 범위 조회는 코드만으로 완결되고 마이그레이션에 의존하지 않는다.
 *
 * 범위가 정확한 근거: Postgres `uuid` 비교는 16바이트 `memcmp`다(`uuid_cmp`).
 * 표준 텍스트 표기는 그 16바이트를 순서대로 hex로 적은 것이므로, uuid의 정렬
 * 순서는 표기 문자열의 사전순과 정확히 같다. 따라서 앞 8자(= 앞 4바이트)가
 * `P`인 UUID 전체 집합은 닫힌 구간 [`P-0000-0000-0000-000000000000`,
 * `P-ffff-ffff-ffff-ffffffffffff`]와 **정확히 일치**한다. PK 인덱스도 그대로 탄다.
 */

/** UUID 앞 8자(= 앞 4바이트) prefix. 소문자 hex만. */
const HEX8 = /^[0-9a-f]{8}$/

export type ParsedPaymentId = {
  meetingId8: string
  userId8: string
}

/**
 * `jdkh-{meetingId8}-{userId8}-{timestamp}` 해석.
 *
 * prefix를 hex 8자로 강제하는 이유는 두 가지다.
 * 1. 조회 범위를 만들 때 자리수가 어긋나면 엉뚱한 구간이 나온다
 * 2. 과거 LIKE 경로에서는 `%`·`_` 와일드카드 주입 차단용이었다 (2026-08-20 스윕).
 *    지금은 LIKE를 안 쓰지만 검증은 남긴다 — 형식이 깨진 paymentId는 그 자체가 신호다
 *
 * @returns 형식이 맞으면 prefix 쌍, 아니면 null
 */
export function parsePaymentId(paymentId: string): ParsedPaymentId | null {
  const parts = paymentId.split('-')
  if (parts.length < 4) return null
  if (parts[0] !== 'jdkh') return null
  if (!HEX8.test(parts[1]) || !HEX8.test(parts[2])) return null
  return { meetingId8: parts[1], userId8: parts[2] }
}

export type UuidRange = {
  /** 구간 하한 (포함) */
  lo: string
  /** 구간 상한 (포함) */
  hi: string
}

/**
 * UUID 앞 8자 prefix → 그 prefix로 시작하는 모든 UUID를 덮는 닫힌 구간.
 *
 * 사용: `.gte('id', lo).lte('id', hi)` — `.like()`를 쓰지 않는다.
 *
 * @returns prefix가 hex 8자면 구간, 아니면 null
 */
export function uuidPrefixRange(prefix8: string): UuidRange | null {
  if (!HEX8.test(prefix8)) return null
  return {
    lo: `${prefix8}-0000-0000-0000-000000000000`,
    hi: `${prefix8}-ffff-ffff-ffff-ffffffffffff`,
  }
}

/**
 * Supabase 응답 중 이 판정에 필요한 최소 형태.
 * PostgrestError·행 타입에 의존하지 않아 테스트에서 그대로 만들어 넣을 수 있다.
 */
export type PrefixLookupResult = {
  data: { id: string }[] | null
  error: { message: string; code?: string } | null
}

export type IdLookupOutcome =
  /** 조회 성공 + 두 행 모두 정확히 1건 */
  | { kind: 'resolved'; meetingId: string; userId: string }
  /** 🔴 조회 자체가 실패 — 우리 쪽 장애다. "대상 없음"으로 삼키면 안 된다 */
  | { kind: 'query_failed'; detail: string }
  /** 조회는 정상인데 해당 모임/회원이 없음 — 재시도해도 달라지지 않는다 */
  | { kind: 'not_found'; detail: string }
  /**
   * 🔴 prefix 하나에 행이 둘 이상 — 누구 결제인지 확정할 수 없다.
   *
   * UUID 앞 8자만 쓰므로 원리적으로 충돌이 가능하다(현 회원 규모에서 확률은
   * 아주 낮지만 0이 아니다). 옛 코드는 `.limit(1)`로 **먼저 나온 행을 조용히
   * 골랐다** — 충돌이 나면 남의 이름으로 신청이 만들어진다. 돈이 걸린 자리에서
   * "아마 이 사람일 것"은 허용하지 않는다. 확정 못 하면 처리하지 않고 남긴다.
   */
  | { kind: 'ambiguous'; detail: string }

function describe(error: { message: string; code?: string }): string {
  return error.code ? `${error.code} ${error.message}` : error.message
}

/**
 * 조회 결과를 세 갈래로 가른다.
 *
 * 🔴 이 함수의 존재 이유가 곧 사고의 교훈이다 — `query_failed`와 `not_found`를
 * 같은 분기로 합치면 **우리 장애가 "처리할 것 없음"으로 둔갑한다.**
 * 호출부는 두 경우에 다르게 응답해야 한다 (실패는 시끄럽게, 없음은 조용히 종결).
 */
export function classifyIdLookup(
  meetingRes: PrefixLookupResult,
  profileRes: PrefixLookupResult,
): IdLookupOutcome {
  const failures: string[] = []
  if (meetingRes.error) failures.push(`meetings: ${describe(meetingRes.error)}`)
  if (profileRes.error) failures.push(`profiles: ${describe(profileRes.error)}`)

  // error가 없는데 data가 null인 경우도 실패로 본다.
  // 정상 응답은 빈 배열(`[]`)이지 null이 아니다 — 과거 버그가 만들어낸 모양이
  // 정확히 "data: null"이었고, 그걸 0행으로 읽은 것이 사고의 시작이었다.
  if (!meetingRes.error && meetingRes.data === null) failures.push('meetings: 응답에 data가 없다')
  if (!profileRes.error && profileRes.data === null) failures.push('profiles: 응답에 data가 없다')

  if (failures.length > 0) {
    return { kind: 'query_failed', detail: failures.join(' | ') }
  }

  const meetingRows = meetingRes.data ?? []
  const profileRows = profileRes.data ?? []

  // 충돌 먼저 본다 — "없음"보다 위험하다. 없으면 아무 일도 안 일어나지만,
  // 둘 중 하나를 고르면 **남의 결제가 만들어진다.**
  // (호출부는 `.limit(2)`로 조회해야 이 분기가 의미를 가진다)
  const collisions: string[] = []
  if (meetingRows.length > 1) collisions.push(`meetings: ${meetingRows.length}건`)
  if (profileRows.length > 1) collisions.push(`profiles: ${profileRows.length}건`)
  if (collisions.length > 0) {
    return { kind: 'ambiguous', detail: `prefix 충돌 — ${collisions.join(', ')}` }
  }

  const meetingId = meetingRows[0]?.id
  const userId = profileRows[0]?.id

  if (!meetingId || !userId) {
    const missing: string[] = []
    if (!meetingId) missing.push('meeting')
    if (!userId) missing.push('user')
    return { kind: 'not_found', detail: `조회 성공, 일치 행 없음: ${missing.join(', ')}` }
  }

  return { kind: 'resolved', meetingId, userId }
}
