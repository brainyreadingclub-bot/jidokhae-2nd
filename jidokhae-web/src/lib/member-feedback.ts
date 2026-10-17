/**
 * 회원 의견 통로 — 「불편한 점 알려 주기」 (2026-10-16, 보관함 I-001).
 *
 * 「나」 탭과 오류 화면에서 들어온다. 회원이 고른 분류 + 자유 글(500자) + 어느 화면에서 왔는지(경로)를
 * `member_feedback` 표에 남기고, 운영자는 `/admin/feedback`(admin 전용)에서 읽는다.
 *
 * 공통 기록표 `app_events`에 넣지 않은 이유는 `supabase/migration-member-feedback.sql` 머리말에 있다
 * (문자열 100자 한도 · 1년 뒤 삭제 · 운영 화면이 아니라 SQL로 세는 표).
 *
 * 🔴 규칙
 * 1. **오류 원문은 담지 않는다.** 오류 화면에서 올 때도 경로만 붙인다 (2026-10-14 결정과 같은 결)
 * 2. **경로에서 쿼리 문자열을 뗀다.** 결제 화면 주소에는 `paymentId` 같은 값이 붙는다
 * 3. **표가 없어도 화면을 깨지 않는다.** 저장 실패는 결과값으로 돌려주고 throw하지 않는다
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { isMissingTableError } from '@/lib/payment-failure-report'

/** 분류 — SQL CHECK(`migration-member-feedback.sql`)와 같아야 한다. 순서 = 화면에 놓이는 순서 */
export const FEEDBACK_CATEGORIES = ['apply', 'screen', 'notice', 'idea', 'etc'] as const
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number]

export const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  apply: '신청 · 결제',
  screen: '화면 · 오류',
  notice: '알림',
  idea: '바라는 점',
  etc: '그 밖에',
}

export const FEEDBACK_SOURCES = ['me', 'error'] as const
export type FeedbackSource = (typeof FEEDBACK_SOURCES)[number]

export const FEEDBACK_SOURCE_LABELS: Record<FeedbackSource, string> = {
  me: '나 탭',
  error: '오류 화면',
}

export const FEEDBACK_BODY_MAX = 500
export const FEEDBACK_PATH_MAX = 200
/** 한 회원이 24시간 안에 보낼 수 있는 글 수 — 장난·반복 전송으로 운영 화면이 묻히지 않게 */
export const FEEDBACK_DAILY_LIMIT = 5

export function isFeedbackCategory(v: unknown): v is FeedbackCategory {
  return typeof v === 'string' && (FEEDBACK_CATEGORIES as readonly string[]).includes(v)
}

export function isFeedbackSource(v: unknown): v is FeedbackSource {
  return typeof v === 'string' && (FEEDBACK_SOURCES as readonly string[]).includes(v)
}

/**
 * 「어느 화면에서 왔나」 정리 (순수 함수). 경로만 남기고, 꼴이 이상하면 null.
 * - `/`로 시작해야 한다. `//`(다른 사이트 주소)는 버린다
 * - `?`·`#` 뒤는 뗀다 — 결제 화면 주소의 `paymentId` 같은 값이 따라오지 않게
 * - 200자에서 자른다
 */
export function sanitizeFeedbackPath(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const path = raw.trim().split(/[?#]/)[0]
  if (!path.startsWith('/') || path.startsWith('//')) return null
  if (/[\s\\]/.test(path)) return null
  return path.slice(0, FEEDBACK_PATH_MAX)
}

export type FeedbackInput = {
  category: FeedbackCategory
  body: string
  source: FeedbackSource
  pagePath: string | null
}

export type FeedbackInputResult =
  | { ok: true; value: FeedbackInput }
  | { ok: false; message: string }

/** 보내온 값 검증 (순수 함수). 메시지는 회원 화면에 그대로 뜨므로 해요체 */
export function resolveFeedbackInput(raw: unknown): FeedbackInputResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, message: '내용을 다시 확인해 주세요' }
  }
  const r = raw as Record<string, unknown>
  if (!isFeedbackCategory(r.category)) {
    return { ok: false, message: '어떤 일인지 하나 골라 주세요' }
  }
  const body = typeof r.body === 'string' ? r.body.trim() : ''
  if (body.length === 0) {
    return { ok: false, message: '내용을 적어 주세요' }
  }
  if (body.length > FEEDBACK_BODY_MAX) {
    return { ok: false, message: `${FEEDBACK_BODY_MAX}자까지 적을 수 있어요` }
  }
  return {
    ok: true,
    value: {
      category: r.category,
      body,
      source: isFeedbackSource(r.source) ? r.source : 'me',
      pagePath: sanitizeFeedbackPath(r.pagePath),
    },
  }
}

export type SaveFeedbackResult =
  | { status: 'saved' }
  | { status: 'limited' }
  | { status: 'table_missing' }
  | { status: 'failed'; message: string }

/**
 * 1건 저장. **throw하지 않는다** — 결과로 돌려준다.
 * 24시간 안에 `FEEDBACK_DAILY_LIMIT`건을 넘기면 저장하지 않는다.
 * `nowMs`는 호출부가 넘긴다(시험에서 시각을 고정하려고). 24시간 창은 시간대와 무관하다
 */
export async function saveMemberFeedback(
  supabase: SupabaseClient,
  userId: string,
  input: FeedbackInput,
  nowMs: number,
): Promise<SaveFeedbackResult> {
  try {
    const since = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString()
    const { count, error: countError } = await supabase
      .from('member_feedback')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', since)
    if (countError) {
      if (isMissingTableError(countError)) return { status: 'table_missing' }
      return { status: 'failed', message: countError.message }
    }
    if ((count ?? 0) >= FEEDBACK_DAILY_LIMIT) return { status: 'limited' }

    const { error } = await supabase.from('member_feedback').insert({
      user_id: userId,
      category: input.category,
      body: input.body,
      source: input.source,
      page_path: input.pagePath,
    })
    if (error) {
      if (isMissingTableError(error)) return { status: 'table_missing' }
      return { status: 'failed', message: error.message }
    }
    return { status: 'saved' }
  } catch (e) {
    return { status: 'failed', message: e instanceof Error ? e.message : String(e) }
  }
}

export type FeedbackRow = {
  id: string
  category: FeedbackCategory
  body: string
  source: FeedbackSource
  page_path: string | null
  created_at: string
  nickname: string | null
}

/** 운영 화면 한 번에 보여 주는 수 — 쌓여도 화면이 끝없이 길어지지 않게 */
export const FEEDBACK_LIST_LIMIT = 100

export type FeedbackListResult =
  | { status: 'ok'; rows: FeedbackRow[]; total: number }
  | { status: 'table_missing' }

/**
 * 운영 화면 목록 — 최근 순 `FEEDBACK_LIST_LIMIT`건 + 전체 수.
 * 표가 없으면 `table_missing`(화면이 안내만 띄운다). 그 밖의 조회 실패는 throw — 오류 화면으로 간다
 */
export async function listMemberFeedback(supabase: SupabaseClient): Promise<FeedbackListResult> {
  const { data, error, count } = await supabase
    .from('member_feedback')
    .select('id, category, body, source, page_path, created_at, profiles(nickname)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(FEEDBACK_LIST_LIMIT)
  if (error) {
    if (isMissingTableError(error)) return { status: 'table_missing' }
    throw new Error(`의견 목록 조회 실패: ${error.message}`)
  }
  type Raw = Omit<FeedbackRow, 'nickname'> & {
    profiles: { nickname: string | null } | { nickname: string | null }[] | null
  }
  const rows = ((data ?? []) as unknown as Raw[]).map(({ profiles, ...rest }) => {
    const p = Array.isArray(profiles) ? profiles[0] : profiles
    return { ...rest, nickname: p?.nickname ?? null }
  })
  return { status: 'ok', rows, total: count ?? rows.length }
}

// ─── 대시보드 긴급 칸 「새 회원 의견 N건」 (2026-10-17) ───

/** 「새」 = 최근 이 날수 안에 들어온 글. 읽음 표시가 없어서 기간으로 가른다 */
export const FEEDBACK_ALERT_DAYS = 7

/** 세기 시작 시각(ISO). 시간대와 무관한 7×24시간 창 */
export function feedbackAlertSince(nowMs: number): string {
  return new Date(nowMs - FEEDBACK_ALERT_DAYS * 24 * 60 * 60 * 1000).toISOString()
}

export type FeedbackAlert =
  | { show: false }
  /** `href`가 null이면 목록을 못 여는 사람 — 줄만 보이고 누를 곳은 없다 */
  | { show: true; text: string; href: string | null; note: string | null }

/**
 * 대시보드 한 줄 판정 (순수 함수).
 * - 0건(또는 셀 수 없음 = null)이면 줄을 안 띄운다 — 늘 켜진 경고는 아무도 안 본다
 * - 운영진에게도 건수는 보인다(숫자에는 개인정보가 없다). 다만 목록은 총괄 전용이라
 *   (글에 연락처가 들어올 수 있다 — `/admin/feedback` 머리말) 운영진 줄은 누를 곳이 없고 「총괄이 확인해요」만 붙는다
 */
export function feedbackAlert(count: number | null, role: string): FeedbackAlert {
  if (count === null || count <= 0) return { show: false }
  const text = `새 회원 의견 ${count}건`
  return role === 'admin'
    ? { show: true, text, href: '/admin/feedback', note: null }
    : { show: true, text, href: null, note: '총괄이 확인해요' }
}

/**
 * 최근 `FEEDBACK_ALERT_DAYS`일 건수. 셀 수 없으면(표 없음·조회 실패) null — 줄을 안 띄운다.
 * 건수만 센다(`head: true`) — 글 본문은 읽지 않는다. **throw하지 않는다** (대시보드를 깨지 않게)
 */
export async function countRecentFeedback(supabase: SupabaseClient, nowMs: number): Promise<number | null> {
  try {
    const { count, error } = await supabase
      .from('member_feedback')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', feedbackAlertSince(nowMs))
    if (error) {
      if (!isMissingTableError(error)) console.error('[member-feedback] 새 의견 세기 실패:', error)
      return null
    }
    return count ?? 0
  } catch (e) {
    console.error('[member-feedback] 새 의견 세기 예외:', e)
    return null
  }
}
