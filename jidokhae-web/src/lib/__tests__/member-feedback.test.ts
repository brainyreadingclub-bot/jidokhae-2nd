import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  FEEDBACK_BODY_MAX,
  FEEDBACK_CATEGORIES,
  FEEDBACK_CATEGORY_LABELS,
  FEEDBACK_DAILY_LIMIT,
  listMemberFeedback,
  resolveFeedbackInput,
  sanitizeFeedbackPath,
  saveMemberFeedback,
  type FeedbackInput,
} from '@/lib/member-feedback'

const U = '20425c26-4b1e-4b3a-9f0c-1a2b3c4d5e6f'
const NOW = Date.parse('2026-10-16T12:00:00Z')

describe('분류 목록', () => {
  it('SQL CHECK와 같은 다섯 값이고, 전부 화면 이름이 있다', () => {
    expect([...FEEDBACK_CATEGORIES]).toEqual(['apply', 'screen', 'notice', 'idea', 'etc'])
    for (const c of FEEDBACK_CATEGORIES) expect(FEEDBACK_CATEGORY_LABELS[c]).toBeTruthy()
  })
})

describe('sanitizeFeedbackPath — 경로만 남긴다', () => {
  it('쿼리·해시를 뗀다 (결제 화면의 paymentId가 따라오지 않게)', () => {
    expect(sanitizeFeedbackPath('/meetings/abc/payment-redirect?paymentId=jdkh-1&txId=2')).toBe(
      '/meetings/abc/payment-redirect',
    )
    expect(sanitizeFeedbackPath('/meet/abc#top')).toBe('/meet/abc')
  })
  it('다른 사이트 주소·상대 경로·공백·역슬래시는 버린다', () => {
    expect(sanitizeFeedbackPath('//evil.example/x')).toBeNull()
    expect(sanitizeFeedbackPath('https://evil.example/x')).toBeNull()
    expect(sanitizeFeedbackPath('meet/abc')).toBeNull()
    expect(sanitizeFeedbackPath('/a b')).toBeNull()
    expect(sanitizeFeedbackPath('/\\evil')).toBeNull()
  })
  it('문자열이 아니면 null, 200자에서 자른다', () => {
    expect(sanitizeFeedbackPath(undefined)).toBeNull()
    expect(sanitizeFeedbackPath(42)).toBeNull()
    expect(sanitizeFeedbackPath('/' + 'a'.repeat(300))).toHaveLength(200)
  })
})

describe('resolveFeedbackInput — 보내온 값 검증', () => {
  const ok = { category: 'screen', body: '버튼이 안 눌려요', source: 'error', pagePath: '/meet/x?y=1' }

  it('정상 입력 — 글은 앞뒤 공백을 떼고 경로는 쿼리를 뗀다', () => {
    const r = resolveFeedbackInput({ ...ok, body: '  버튼이 안 눌려요  ' })
    expect(r).toEqual({
      ok: true,
      value: { category: 'screen', body: '버튼이 안 눌려요', source: 'error', pagePath: '/meet/x' },
    })
  })
  it('분류가 목록 밖이면 거절', () => {
    expect(resolveFeedbackInput({ ...ok, category: 'payment' }).ok).toBe(false)
    expect(resolveFeedbackInput({ ...ok, category: undefined }).ok).toBe(false)
  })
  it('빈 글·공백만 있는 글은 거절', () => {
    expect(resolveFeedbackInput({ ...ok, body: '' }).ok).toBe(false)
    expect(resolveFeedbackInput({ ...ok, body: '   \n ' }).ok).toBe(false)
    expect(resolveFeedbackInput({ ...ok, body: 123 }).ok).toBe(false)
  })
  it('500자는 받고 501자는 거절 (경계)', () => {
    expect(resolveFeedbackInput({ ...ok, body: '가'.repeat(FEEDBACK_BODY_MAX) }).ok).toBe(true)
    const over = resolveFeedbackInput({ ...ok, body: '가'.repeat(FEEDBACK_BODY_MAX + 1) })
    expect(over).toEqual({ ok: false, message: '500자까지 적을 수 있어요' })
  })
  it('출처가 이상하면 「나 탭」으로, 경로가 이상하면 null로 받는다 (글은 버리지 않는다)', () => {
    const r = resolveFeedbackInput({ ...ok, source: 'admin', pagePath: '//evil' })
    expect(r.ok && r.value.source).toBe('me')
    expect(r.ok && r.value.pagePath).toBeNull()
  })
  it('객체가 아니면 거절', () => {
    expect(resolveFeedbackInput(null).ok).toBe(false)
    expect(resolveFeedbackInput('글').ok).toBe(false)
    expect(resolveFeedbackInput([ok]).ok).toBe(false)
  })
  it('오류 원문 같은 다른 칸은 결과에 실리지 않는다', () => {
    const r = resolveFeedbackInput({ ...ok, errorMessage: '홈 참가자 수 조회 실패: …', digest: 'abc' })
    expect(r.ok && Object.keys(r.value).sort()).toEqual(['body', 'category', 'pagePath', 'source'])
  })
})

/** count 조회(select→eq→gte) + insert 를 흉내 내는 최소 가짜 클라이언트 */
function fakeClient(opts: {
  count?: number
  countError?: { code?: string; message: string } | null
  insertError?: { code?: string; message: string } | null
}) {
  const insert = vi.fn().mockResolvedValue({ error: opts.insertError ?? null })
  const gte = vi.fn().mockResolvedValue({ count: opts.count ?? 0, error: opts.countError ?? null })
  const eq = vi.fn(() => ({ gte }))
  const select = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ select, insert }))
  return { client: { from } as unknown as SupabaseClient, insert, eq, gte }
}

const INPUT: FeedbackInput = { category: 'apply', body: '결제가 멈췄어요', source: 'me', pagePath: '/me' }

describe('saveMemberFeedback', () => {
  it('저장한다 — 칸 이름이 SQL과 같다', async () => {
    const f = fakeClient({})
    await expect(saveMemberFeedback(f.client, U, INPUT, NOW)).resolves.toEqual({ status: 'saved' })
    expect(f.insert).toHaveBeenCalledWith({
      user_id: U,
      category: 'apply',
      body: '결제가 멈췄어요',
      source: 'me',
      page_path: '/me',
    })
  })
  it('24시간 창으로 본인 글만 센다', async () => {
    const f = fakeClient({})
    await saveMemberFeedback(f.client, U, INPUT, NOW)
    expect(f.eq).toHaveBeenCalledWith('user_id', U)
    expect(f.gte).toHaveBeenCalledWith('created_at', '2026-10-15T12:00:00.000Z')
  })
  it(`24시간 안에 ${FEEDBACK_DAILY_LIMIT}건이면 더 받지 않는다 (경계: 한도-1은 받는다)`, async () => {
    const under = fakeClient({ count: FEEDBACK_DAILY_LIMIT - 1 })
    await expect(saveMemberFeedback(under.client, U, INPUT, NOW)).resolves.toEqual({ status: 'saved' })
    const at = fakeClient({ count: FEEDBACK_DAILY_LIMIT })
    await expect(saveMemberFeedback(at.client, U, INPUT, NOW)).resolves.toEqual({ status: 'limited' })
    expect(at.insert).not.toHaveBeenCalled()
  })
  it('표가 없으면(SQL 미실행) table_missing — 던지지 않는다', async () => {
    const f = fakeClient({ countError: { code: 'PGRST205', message: 'Could not find the table' } })
    await expect(saveMemberFeedback(f.client, U, INPUT, NOW)).resolves.toEqual({ status: 'table_missing' })
    const g = fakeClient({ insertError: { code: '42P01', message: 'relation does not exist' } })
    await expect(saveMemberFeedback(g.client, U, INPUT, NOW)).resolves.toEqual({ status: 'table_missing' })
  })
  it('그 밖의 실패·예외도 결과로 돌려준다', async () => {
    const f = fakeClient({ insertError: { code: '23514', message: 'check violation' } })
    await expect(saveMemberFeedback(f.client, U, INPUT, NOW)).resolves.toEqual({
      status: 'failed',
      message: 'check violation',
    })
    const boom = { from: () => { throw new Error('fetch failed') } } as unknown as SupabaseClient
    await expect(saveMemberFeedback(boom, U, INPUT, NOW)).resolves.toEqual({
      status: 'failed',
      message: 'fetch failed',
    })
  })
})

describe('listMemberFeedback', () => {
  function listClient(result: { data?: unknown[]; error?: { code?: string; message: string } | null; count?: number }) {
    const limit = vi.fn().mockResolvedValue({ data: result.data ?? [], error: result.error ?? null, count: result.count ?? null })
    const order = vi.fn(() => ({ limit }))
    const select = vi.fn(() => ({ order }))
    return { from: vi.fn(() => ({ select })) } as unknown as SupabaseClient
  }

  it('닉네임을 펴서 돌려준다 (배열·객체 둘 다)', async () => {
    const base = { category: 'idea', body: 'b', source: 'me', page_path: '/me', created_at: '2026-10-16T00:00:00Z' }
    const r = await listMemberFeedback(
      listClient({
        data: [
          { id: '1', ...base, profiles: { nickname: '초록고래' } },
          { id: '2', ...base, profiles: [{ nickname: '파란새' }] },
          { id: '3', ...base, profiles: null },
        ],
        count: 7,
      }),
    )
    expect(r.status).toBe('ok')
    if (r.status !== 'ok') return
    expect(r.total).toBe(7)
    expect(r.rows.map((x) => x.nickname)).toEqual(['초록고래', '파란새', null])
    expect(r.rows[0]).not.toHaveProperty('profiles')
  })
  it('표가 없으면 table_missing, 그 밖의 실패는 던진다', async () => {
    await expect(
      listMemberFeedback(listClient({ error: { code: '42P01', message: 'does not exist' } })),
    ).resolves.toEqual({ status: 'table_missing' })
    await expect(
      listMemberFeedback(listClient({ error: { code: '500', message: 'boom' } })),
    ).rejects.toThrow('의견 목록 조회 실패')
  })
})
