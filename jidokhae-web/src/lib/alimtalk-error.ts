/**
 * 알림톡 발송 실패 → `notifications.error_message`에 남길 글 (순수 함수).
 *
 * 왜 — 2026-03~06월 실패 123건의 사유가 전부 같은 한 줄이었다:
 * 「1개의 메시지가 접수되지 못했습니다. 자세한 에러 메시지는 해당 에러 내 failedMessageList를 확인해주세요.」
 * Solapi는 진짜 이유(상태 코드·설명)를 `failedMessageList`에 담아 주는데 그걸 버리고 이 안내 문장만
 * 저장해서, 넉 달 동안 원인을 알 수 없었다 (2026-07-30 전문가 검토).
 *
 * 🔴 전화번호는 남기지 않는다 — `failedMessageList`의 `to`·`from`은 버리고 코드·설명만 쓴다.
 */

/** error_message 칸에 넣을 최대 글자 수 — 원문이 길어도 화면·DB가 버틸 만큼 */
export const ERROR_MESSAGE_MAX = 300

type FailedMessageLike = { statusCode?: unknown; statusMessage?: unknown }

function describeFailedList(list: unknown): string | null {
  if (!Array.isArray(list) || list.length === 0) return null
  const parts = (list as FailedMessageLike[]).map((f) => {
    const code = typeof f?.statusCode === 'string' || typeof f?.statusCode === 'number' ? String(f.statusCode) : '?'
    const msg = typeof f?.statusMessage === 'string' ? f.statusMessage : ''
    return msg ? `[${code}] ${msg}` : `[${code}]`
  })
  return Array.from(new Set(parts)).join(' / ')
}

/** send()가 던진 에러 → 저장할 글. 실패 목록이 있으면 그것을, 없으면 에러 이름과 문장을 */
export function describeAlimtalkError(error: unknown): string {
  let text: string
  if (error && typeof error === 'object') {
    const e = error as { failedMessageList?: unknown; _tag?: unknown; name?: unknown; message?: unknown }
    const fromList = describeFailedList(e.failedMessageList)
    if (fromList) {
      text = fromList
    } else {
      const tag = typeof e._tag === 'string' ? e._tag : typeof e.name === 'string' ? e.name : 'Error'
      const message = typeof e.message === 'string' ? e.message : ''
      text = message ? `${tag}: ${message}` : tag
    }
  } else if (typeof error === 'string') {
    text = error
  } else {
    text = '알 수 없는 오류'
  }
  return text.slice(0, ERROR_MESSAGE_MAX)
}

/**
 * send()가 던지지 않고 돌아왔는데 접수 실패가 섞여 있는 경우. 한 통씩 보내므로 보통은 던지지만
 * (모두 실패면 SDK가 던진다), 응답 꼴이 바뀌어도 「보냄」으로 잘못 적지 않게 한 번 더 본다.
 * 실패가 있으면 저장할 글, 없으면 null.
 */
export function failedFromSendResult(result: unknown): string | null {
  if (!result || typeof result !== 'object') return null
  const fromList = describeFailedList((result as { failedMessageList?: unknown }).failedMessageList)
  return fromList ? fromList.slice(0, ERROR_MESSAGE_MAX) : null
}
