/**
 * 메타 Conversions API (서버 사이드 이벤트) 래퍼.
 *
 * 왜 필요한가 — 브라우저 픽셀만으로는 iOS 추적 제한·광고 차단기·네트워크 유실로
 * 결제 이벤트의 상당수가 메타에 도달하지 않는다. 광고비를 태우는 순간
 * "전환이 실제보다 적게 잡히는" 상태가 되어 최적화가 잘못 학습한다.
 * 서버는 결제 확정을 확실히 알고 있으므로 여기서 한 번 더 쏜다.
 *
 * ⚠️ 중복 집계 방지 (가장 중요)
 *   클라이언트 픽셀과 서버가 **같은 event_name + event_id**를 보내야
 *   메타가 하나로 합친다. 결제는 paymentId를 event_id로 쓴다.
 *   dedup이 깨지면 결제 1건이 2건으로 잡혀 ROAS가 절반으로 왜곡된다.
 *   클라이언트 쪽은 trackEvent(..., { eventId }) — src/lib/analytics.ts
 *
 * ⚠️ 호출 규칙
 *   반드시 next/server의 after()로 감쌀 것. void fire-and-forget은
 *   Vercel 람다 freeze로 유실된다 (2026-08-17 Preview 실측 13분 지연).
 *
 * ⚠️ 개인정보
 *   기본값은 **전화번호를 보내지 않는다**. 해시를 씌워도 매칭 목적의
 *   개인정보 국외이전에 해당하므로, 개인정보처리방침에 고지한 뒤
 *   META_CAPI_INCLUDE_PHONE=on으로 켜는 순서를 지킨다.
 *   기본 전송 항목은 픽셀이 이미 브라우저에서 보내는 것과 같은 범위
 *   (IP·User-Agent·픽셀 쿠키) + 가명화된 external_id 뿐이다.
 */

import { createHash } from 'crypto'

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID
const ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN
const TEST_EVENT_CODE = process.env.META_CAPI_TEST_EVENT_CODE
const INCLUDE_PHONE = process.env.META_CAPI_INCLUDE_PHONE === 'on'

const GRAPH_API_VERSION = 'v21.0'

/** 토큰·픽셀 ID가 모두 있을 때만 동작. 없으면 조용히 no-op (개발/프리뷰 안전). */
export function isMetaCapiEnabled(): boolean {
  return Boolean(PIXEL_ID && ACCESS_TOKEN)
}

/** 메타 요구사항: 소문자 + 공백 제거 후 SHA-256 hex. */
export function hashForMeta(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex')
}

/**
 * 한국 휴대폰 → 메타가 요구하는 국가코드 포함 숫자열.
 * '010-1234-5678' → '821012345678'
 * 형식을 못 맞추면 null (틀린 값으로 매칭률을 떨어뜨리느니 안 보낸다).
 */
export function normalizeKRPhone(phone: string | null | undefined): string | null {
  if (!phone) return null

  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('82')) return digits.length >= 11 ? digits : null
  if (digits.startsWith('0')) return digits.length >= 10 ? `82${digits.slice(1)}` : null

  return null
}

type SendMetaEventParams = {
  /** 메타 표준 이벤트명 (예: 'Purchase') */
  eventName: string
  /** 클라이언트 픽셀과 동일해야 하는 dedup 키 */
  eventId: string
  /** 이벤트가 일어난 페이지 URL */
  eventSourceUrl?: string | null
  userData: {
    /** 로그인 사용자 UUID — 해시해서 external_id로 보낸다 */
    userId?: string | null
    phone?: string | null
    clientIp?: string | null
    clientUserAgent?: string | null
    /** 브라우저 픽셀이 심는 쿠키. 매칭률을 크게 올린다 */
    fbp?: string | null
    fbc?: string | null
  }
  customData?: Record<string, unknown>
}

/**
 * 메타로 서버 이벤트 1건 전송.
 * 절대 throw하지 않는다 — 마케팅 계측 실패가 결제 흐름을 건드리면 안 된다.
 */
export async function sendMetaEvent(params: SendMetaEventParams): Promise<void> {
  if (!isMetaCapiEnabled()) return

  const { eventName, eventId, eventSourceUrl, userData, customData } = params

  const user_data: Record<string, unknown> = {}
  if (userData.userId) user_data.external_id = hashForMeta(userData.userId)
  if (userData.clientIp) user_data.client_ip_address = userData.clientIp
  if (userData.clientUserAgent) user_data.client_user_agent = userData.clientUserAgent
  if (userData.fbp) user_data.fbp = userData.fbp
  if (userData.fbc) user_data.fbc = userData.fbc

  if (INCLUDE_PHONE) {
    const normalized = normalizeKRPhone(userData.phone)
    if (normalized) user_data.ph = hashForMeta(normalized)
  }

  const payload: Record<string, unknown> = {
    data: [
      {
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        action_source: 'website',
        ...(eventSourceUrl ? { event_source_url: eventSourceUrl } : {}),
        user_data,
        ...(customData ? { custom_data: customData } : {}),
      },
    ],
  }

  // 이벤트 관리자 > 테스트 이벤트 탭에서 확인할 때만 사용
  if (TEST_EVENT_CODE) payload.test_event_code = TEST_EVENT_CODE

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    )

    if (!res.ok) {
      // 토큰 만료·픽셀 ID 오타가 조용히 묻히면 몇 주 뒤에야 발견된다.
      console.error('[meta-capi] 전송 실패:', res.status, await res.text())
    }
  } catch (error) {
    console.error('[meta-capi] 전송 예외:', error)
  }
}

/** 요청 헤더에서 클라이언트 IP 추출 (Vercel은 x-forwarded-for에 실어 보낸다). */
export function getClientIp(headers: Headers): string | null {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return headers.get('x-real-ip')
}
