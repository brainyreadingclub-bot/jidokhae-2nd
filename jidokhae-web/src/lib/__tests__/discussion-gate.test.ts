/**
 * `getDiscussionApplyBlock` — 서버 신청 경로 관문의 **실패 모드** 회귀 테스트.
 *
 * 🔴 왜 이 파일이 있는가
 *   자격 판정은 DB를 읽는다. 그 읽기가 실패했을 때 "자격 없음"으로 읽으면,
 *   `payment.ts`가 **이미 승인된 결제를 환불한다** — DB가 잠깐 흔들린 것이 회원 돈을
 *   돌려보내는 사고가 된다. 같은 모양으로 6명 72,000이 나간 적이 있다
 *   (2026-10-06, `docs/agent-team/조사/2026-10-06-중복환불-사고.md`).
 *
 *   그래서 `query_failed`는 **잠그지 않는다(fail open).** 아래 두 테스트가 그것을 못 박는다.
 *   깨지면 그 사고가 다른 문으로 돌아온 것이다. 지우지 말 것.
 *
 * 자격 규칙 자체(당일 미경과·화이트리스트·윈도우 없음)는 `discussion-eligibility.test.ts`가 본다.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  getSiteSettings: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createServiceClient: mocks.createServiceClient,
}))
vi.mock('@/lib/site-settings', () => ({
  getSiteSettings: mocks.getSiteSettings,
  DEFAULT_PAYMENT_MODE: 'card_only',
}))

import { getDiscussionApplyBlock } from '@/lib/discussion-gate'

type Res = { data: unknown; error: { message: string } | null }

type Chain = {
  select: () => Chain
  eq: () => Chain
  in: () => Chain
  maybeSingle: () => Promise<Res>
  then: <T>(onFulfilled: (v: Res) => T) => Promise<T>
}

function chainFor(result: Res): Chain {
  const chain: Chain = {
    select: () => chain,
    eq: () => chain,
    in: () => chain,
    maybeSingle: async () => result,
    then: (onFulfilled) => Promise.resolve(result).then(onFulfilled),
  }
  return chain
}

/** `profiles`·`registrations` 두 표만 가진 최소 대역 */
function fakeClient(profile: Res, regs: Res) {
  return {
    from: (table: string) => chainFor(table === 'profiles' ? profile : regs),
  }
}

const MEMBER = { data: { role: 'member', is_staff: false }, error: null }
const STAFF = { data: { role: 'member', is_staff: true }, error: null }
const FAILED = { data: null, error: { message: 'simulated query failure' } }
const NO_REGS = { data: [], error: null }
const PAST_REGULAR = {
  data: [
    {
      status: 'confirmed',
      meetings: { date: '2026-01-10', meeting_type: 'regular', status: 'active' },
    },
  ],
  error: null,
}

/**
 * `getDiscussionEligibility`는 React `cache()`로 감싸여 있다 —
 * 같은 userId를 재사용하면 앞 테스트 결과가 남을 수 있어 **테스트마다 다른 id**를 쓴다
 */
let seq = 0
const nextUser = () => `user-${++seq}`

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getSiteSettings.mockResolvedValue({ discussion_meeting_enabled: 'on' })
})

describe('getDiscussionApplyBlock — 잠가야 하는 것', () => {
  it('플래그 OFF면 paused — 행이 없을 때도 OFF다', async () => {
    mocks.getSiteSettings.mockResolvedValue({})
    mocks.createServiceClient.mockReturnValue(fakeClient(MEMBER, PAST_REGULAR))
    expect(await getDiscussionApplyBlock('discussion', nextUser())).toBe('paused')
  })

  it('정기 참여 0건 + 운영 주체 아님이면 not_eligible', async () => {
    mocks.createServiceClient.mockReturnValue(fakeClient(MEMBER, NO_REGS))
    expect(await getDiscussionApplyBlock('discussion', nextUser())).toBe('not_eligible')
  })
})

describe('getDiscussionApplyBlock — 잠그면 안 되는 것', () => {
  it('지난 정기모임 참여가 있으면 통과', async () => {
    mocks.createServiceClient.mockReturnValue(fakeClient(MEMBER, PAST_REGULAR))
    expect(await getDiscussionApplyBlock('discussion', nextUser())).toBeNull()
  })

  it('스텝(is_staff)은 참여 0건이어도 통과 — isCurator 우회', async () => {
    mocks.createServiceClient.mockReturnValue(fakeClient(STAFF, NO_REGS))
    expect(await getDiscussionApplyBlock('discussion', nextUser())).toBeNull()
  })

  it('🔴 신청 이력 조회가 실패하면 잠그지 않는다 — 결제 환불을 유발하면 안 된다', async () => {
    mocks.createServiceClient.mockReturnValue(fakeClient(MEMBER, FAILED))
    expect(await getDiscussionApplyBlock('discussion', nextUser())).toBeNull()
  })

  it('🔴 프로필 조회가 실패하면 잠그지 않는다 — 운영자를 미자격으로 깎지 않는다', async () => {
    mocks.createServiceClient.mockReturnValue(fakeClient(FAILED, NO_REGS))
    expect(await getDiscussionApplyBlock('discussion', nextUser())).toBeNull()
  })

  it('정기모임은 유형 검사에서 바로 통과한다 — DB를 읽지도 않는다', async () => {
    mocks.createServiceClient.mockReturnValue(fakeClient(MEMBER, NO_REGS))
    expect(await getDiscussionApplyBlock('regular', nextUser())).toBeNull()
    expect(mocks.createServiceClient).not.toHaveBeenCalled()
    expect(mocks.getSiteSettings).not.toHaveBeenCalled()
  })

  it('meeting_type이 null/미지정이어도 막지 않는다 — 자격은 토론모임에만 건다', async () => {
    mocks.createServiceClient.mockReturnValue(fakeClient(MEMBER, NO_REGS))
    expect(await getDiscussionApplyBlock(null, nextUser())).toBeNull()
    expect(await getDiscussionApplyBlock(undefined, nextUser())).toBeNull()
  })
})
