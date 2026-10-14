/**
 * 공통 기록표 `app_events` — 「회원이 무엇을 눌렀나」를 우리 DB에 남긴다 (2026-10-14).
 *
 * 홈 「다가오는 정기모임」 전용 표(`home_upcoming_clicks`)를 만들려다, 기록할 일이 생길 때마다
 * 표를 하나씩 늘리지 않으려고 공통 표 하나로 바꿨다. 이벤트 목록·이름 규칙·넣으면 안 되는 것은
 * `docs/agent-team/기록표-이벤트-목록.md`가 정본이다 — **이벤트를 더하면 아래 목록과 그 문서를 둘 다 고친다.**
 *
 * 🔴 규칙 세 가지
 * 1. **이름은 아래 `APP_EVENTS` 목록에 있는 것만.** 타입이 목록 밖 이름을 tsc에서 막고,
 *    런타임에서도 목록 밖이면 기록하지 않는다
 * 2. **실명·전화·이메일·결제 정보를 넣지 않는다.** `sanitizeEventProps`가 그런 키·값을 지운다
 * 3. **화면을 막지 않는다.** `recordAppEvent`는 절대 throw하지 않는다. 호출부는 `after()`로 감싼다
 *    (`void`는 Vercel에서 유실된다). 표가 아직 없어도(SQL 미실행) 경고만 남고 화면은 그대로다
 */

import { createServiceClient } from '@/lib/supabase/admin'

/**
 * 기록해도 되는 이벤트 — 「화면.행동」, 영어 소문자·숫자·밑줄, 점 하나.
 * GA에도 보내는 이벤트는 **GA 이름 = 점 뒤 부분**이다 (`gaEventName`). GA 이름에는 점이 못 들어간다
 */
export const APP_EVENTS = [
  /** 홈 「다가오는 정기모임」 카드를 눌러 모임 상세에 도착 (/meet/[id]?from=home_upcoming&pos=N) */
  'home_upcoming.meeting_click',
  /** 홈 「다른 일정도 보기」를 눌러 모임 탭에 도착 (/meet?from=home_upcoming_more) */
  'home_upcoming.more_click',
  /** 새 모임 탭(/meet) 목록을 봤다. GA view_item_list와 짝 */
  'meet.view_item_list',
  /** 계좌이체·0원 신청이 접수됐다 (register_transfer 결과가 자리·대기). GA sign_up_meeting과 짝 */
  'registration.sign_up_meeting',
] as const

export type AppEventName = (typeof APP_EVENTS)[number]

const EVENT_SET: ReadonlySet<string> = new Set(APP_EVENTS)

export function isAppEventName(name: string): name is AppEventName {
  return EVENT_SET.has(name)
}

/** GA 이벤트 이름 — app_events 이름의 점 뒤 부분 (`meet.view_item_list` → `view_item_list`) */
export function gaEventName(name: AppEventName): string {
  return name.slice(name.indexOf('.') + 1)
}

export type AppEventProps = Record<string, string | number | boolean>

export const PROPS_MAX_KEYS = 10
export const PROPS_MAX_STRING = 100

const KEY_RE = /^[a-z][a-z0-9_]{0,39}$/
/**
 * 키 이름에 이 조각이 들어가면 지운다 (소문자로 바꾸고 밑줄·하이픈을 뗀 뒤 비교).
 * `name`이 `nickname`·`real_name`을, `account`가 `bank_account`를 함께 막는다.
 * `payment_method`는 결제 수단 종류(transfer/card)라 막지 않는다 — 결제 **식별자**만 막는다
 */
const FORBIDDEN_KEY_PARTS = [
  'name',
  'phone',
  'mail',
  'card',
  'account',
  'bank',
  'depositor',
  'address',
  'paymentid',
  'paymentkey',
  'txid',
  'transactionid',
  'orderid',
  'password',
  'token',
  'secret',
] as const
const FORBIDDEN_KEY_EXACT = new Set(['tel', 'mobile'])
/** 값 자체가 이메일·한국 전화번호처럼 생겼으면 키가 무엇이든 지운다 */
const EMAIL_LIKE = /[^\s@]+@[^\s@]+\.[^\s@]+/
const PHONE_LIKE = /0\d{1,2}[-\s.]?\d{3,4}[-\s.]?\d{4}/

export function isForbiddenPropKey(key: string): boolean {
  const k = key.toLowerCase().replace(/[^a-z0-9]/g, '')
  return FORBIDDEN_KEY_EXACT.has(k) || FORBIDDEN_KEY_PARTS.some((p) => k.includes(p))
}

/**
 * props 정화 (순수 함수). 남는 것은 문자열·숫자·참거짓 값뿐이다.
 * - 키는 영어 소문자로 시작하는 짧은 이름만, 최대 10개 (넘는 것은 버린다)
 * - 개인정보·결제 정보로 읽히는 키는 지운다 (`isForbiddenPropKey`)
 * - 문자열은 100자로 자르고, 이메일·전화번호처럼 생긴 값은 지운다
 * - 숫자는 유한한 값만. 객체·배열·null은 버린다
 */
export function sanitizeEventProps(input: Record<string, unknown> | null | undefined): AppEventProps {
  const out: AppEventProps = {}
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out
  let kept = 0
  for (const [key, value] of Object.entries(input)) {
    if (kept >= PROPS_MAX_KEYS) break
    if (!KEY_RE.test(key) || isForbiddenPropKey(key)) continue
    if (typeof value === 'string') {
      if (EMAIL_LIKE.test(value) || PHONE_LIKE.test(value)) continue
      out[key] = value.slice(0, PROPS_MAX_STRING)
    } else if (typeof value === 'number') {
      if (!Number.isFinite(value)) continue
      out[key] = value
    } else if (typeof value === 'boolean') {
      out[key] = value
    } else {
      continue
    }
    kept++
  }
  return out
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type AppEventInput = {
  event: AppEventName
  userId: string | null | undefined
  meetingId?: string | null
  props?: Record<string, unknown>
}

/** 표에 넣을 한 줄 (순수 함수). 목록 밖 이름이면 null = 기록하지 않는다 */
export function buildAppEventRow(input: AppEventInput): {
  event: AppEventName
  user_id: string | null
  meeting_id: string | null
  props: AppEventProps
} | null {
  if (!isAppEventName(input.event)) return null
  return {
    event: input.event,
    user_id: input.userId && UUID_RE.test(input.userId) ? input.userId : null,
    // uuid 칸이라 꼴이 아니면 insert가 통째로 거절된다 — 모임만 비우고 이벤트는 남긴다
    meeting_id: input.meetingId && UUID_RE.test(input.meetingId) ? input.meetingId : null,
    props: sanitizeEventProps(input.props),
  }
}

/**
 * 이벤트 1건 기록. **절대 throw하지 않는다.**
 *
 * @example
 *   after(recordAppEvent({ event: 'meet.view_item_list', userId: user?.id, props: { items_count: 3 } }))
 */
export async function recordAppEvent(input: AppEventInput): Promise<void> {
  try {
    const row = buildAppEventRow(input)
    if (!row) {
      console.warn('[app-events] 목록에 없는 이벤트라 기록하지 않음:', String(input.event).slice(0, 60))
      return
    }
    const supabase = createServiceClient()
    const { error } = await supabase.from('app_events').insert(row)
    if (error) console.warn(`[app-events] 기록 실패 (${row.event}):`, error.message)
  } catch (e) {
    console.warn('[app-events] 기록 중 예외:', e)
  }
}
