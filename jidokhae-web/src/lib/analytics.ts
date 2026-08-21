/**
 * GA4 + 메타 픽셀 공용 이벤트 래퍼.
 *
 * 호출부는 지금까지처럼 trackEvent('purchase', {...})만 쓰면 된다.
 * GA4로는 모든 이벤트가 그대로 나가고, 메타 픽셀로는 META_EVENT_MAP에
 * 매핑된 표준 이벤트만 나간다.
 *
 * 왜 전부 안 보내나 — purchase_failed·refund·ask_strip_view 같은 내부 지표를
 * 픽셀에 흘리면 광고 최적화가 학습할 신호만 흐려진다. 메타는 표준 이벤트로
 * 캠페인 목표를 잡으므로, 매핑에 없는 건 GA 전용으로 둔다.
 *
 * ⚠️ 중복 집계 — 같은 행동을 서버(Conversions API)에서도 쏘는 경우
 * 양쪽에 **같은 eventId**를 넘겨야 한다. 메타는 event_name + event_id로만
 * dedup하며, 안 넘기면 결제 1건이 2건으로 잡혀 ROAS가 절반으로 왜곡된다.
 * 서버 쪽 대응은 src/lib/meta-capi.ts 참조.
 */

type EventParams = Record<string, string | number | boolean | undefined>

type TrackOptions = {
  /** 서버에서도 같은 이벤트를 쏠 때의 dedup 키. 결제는 paymentId를 쓴다. */
  eventId?: string
  /** GA로만 보내고 메타 픽셀은 건너뛴다. 첫 진입 PageView 중복 방지용 */
  skipMeta?: boolean
}

/**
 * GA4 이벤트명 → 메타 픽셀 표준 이벤트명.
 * 여기 없는 이벤트는 픽셀로 나가지 않는다 (의도된 동작).
 *
 * page_view가 매핑돼 있는 이유 — SPA 라우트 이동도 픽셀에서 페이지뷰로 잡아야
 * 리타게팅 모수가 쌓인다. 단 **첫 진입은 레이아웃의 베이스 스니펫이 직접 쏘므로**
 * RouteChangeTracker가 첫 회에 skipMeta로 건너뛴다 (안 그러면 2중 집계).
 * 자세한 분담은 src/app/layout.tsx의 픽셀 주석 참조.
 */
export const META_EVENT_MAP: Record<string, string> = {
  page_view: 'PageView',
  view_item: 'ViewContent',
  view_item_list: 'ViewContent',
  begin_checkout: 'InitiateCheckout',
  purchase: 'Purchase',
  sign_up: 'CompleteRegistration',
}

/**
 * GA4 파라미터 → 메타 custom_data.
 * 메타가 실제로 읽는 키만 추린다 (registration_type 같은 내부 값은 GA에만 남김).
 */
export function toMetaParams(params?: EventParams): Record<string, unknown> {
  if (!params) return {}

  const meta: Record<string, unknown> = {}

  if (params.currency !== undefined) meta.currency = params.currency
  if (params.value !== undefined) meta.value = params.value
  if (params.meeting_id !== undefined) {
    meta.content_ids = [params.meeting_id]
    meta.content_type = 'product'
  }

  return meta
}

export function trackEvent(name: string, params?: EventParams, options?: TrackOptions) {
  if (typeof window === 'undefined') return

  window.gtag?.('event', name, params)

  if (options?.skipMeta) return

  const metaName = META_EVENT_MAP[name]
  if (!metaName) return

  window.fbq?.(
    'track',
    metaName,
    toMetaParams(params),
    options?.eventId ? { eventID: options.eventId } : undefined,
  )
}
