/**
 * 결제창이 실패로 돌아왔을 때 — **회원이 직접 닫은 것인지, 결제가 안 된 것인지** 가른다.
 * 화면 문구에만 쓴다(결제 확인·이동 로직은 이 값을 보지 않는다).
 *
 * 근거
 * - `USER_CANCEL`·`PAY_PROCESS_CANCELED` — 옛 결제 실패 화면(`PaymentFailClient`)이 이미 「취소」로 보던 코드
 * - `Cancelled` — 포트원 V2 SDK의 오류 코드 목록(`@portone/browser-sdk` `GrpcErrorCode.Cancelled`)
 * - 포트원 V2 리다이렉트는 `code`·`message` 외에 PG가 준 `pgCode`·`pgMessage`를 붙인다.
 *   카카오페이 채널에서 회원이 결제창을 닫을 때 정확히 어떤 코드가 오는지는 저장소 안에서
 *   확인할 근거가 없다 — 그래서 PG 문구에 「취소」가 들어 있으면 취소로 본다.
 *   틀려도 문구만 달라진다(「결제가 되지 않았어요」로 보일 뿐 돈·신청에는 영향 없음).
 */
const CANCEL_CODES = new Set(['USER_CANCEL', 'PAY_PROCESS_CANCELED', 'Cancelled'])

export function isPaymentCancelled(p: {
  code: string | null
  pgCode?: string | null
  message?: string | null
  pgMessage?: string | null
}): boolean {
  if (p.code && CANCEL_CODES.has(p.code)) return true
  if (p.pgCode && CANCEL_CODES.has(p.pgCode)) return true
  return [p.message, p.pgMessage].some((m) => !!m && safeDecode(m).includes('취소'))
}

function safeDecode(raw: string): string {
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}
