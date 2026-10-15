import { isPaymentCancelled } from '@/lib/payment-cancel'

/**
 * 결제창이 실패로 돌아왔을 때 화면에 띄울 문구 — **정해 둔 문구만 돌려준다.**
 *
 * 주소의 `message`·`pgMessage`는 누구나 링크에 써 넣을 수 있다. 그 원문을 그대로 띄우면
 * 남이 만든 링크로 공식 화면에 아무 글(예: 계좌 안내)이나 뜬다. 그래서 원문은 화면에 절대
 * 내보내지 않고, 취소인지 아닌지를 가르는 데만 쓴다(`isPaymentCancelled`). 원문은 로그로만 남긴다.
 * 결제 실패 화면(`PaymentFailClient`)과 결제 확인 화면(`PaymentRedirectClient`)이 같이 쓴다.
 */
export const PAYMENT_CANCELLED_MESSAGE = '결제가 취소됐어요'
export const PAYMENT_FAILED_MESSAGE = '결제가 되지 않았어요. 잠깐 뒤에 다시 시도해 주세요'

export function getPaymentFailMessage(p: {
  code: string | null
  pgCode?: string | null
  message?: string | null
  pgMessage?: string | null
}): string {
  // 코드 없이 실패 화면에 온 경우 — 옛 화면처럼 취소로 본다
  if (!p.code) return PAYMENT_CANCELLED_MESSAGE
  return isPaymentCancelled(p) ? PAYMENT_CANCELLED_MESSAGE : PAYMENT_FAILED_MESSAGE
}

const LOG_MAX = 200

/** 로그에 남길 원문 — 길이만 자른다 (화면에는 쓰지 않는다) */
export function clipForLog(raw: string | null | undefined): string | null {
  if (!raw) return null
  return raw.length > LOG_MAX ? `${raw.slice(0, LOG_MAX)}…` : raw
}
