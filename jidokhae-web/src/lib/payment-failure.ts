/**
 * 돈에 닿는 경로의 실패를 **우리 DB에** 남긴다 (`payment_failures`).
 *
 * 왜 필요한가 (2026-09-10 고아 결제 사고)
 * ------------------------------------------------
 * 웹훅은 몇 달간 `[portone-webhook] ID 조회 실패`를 console.error로 찍고 있었다.
 * 아무도 못 봤다. 2026-09-11 실측: Vercel 런타임 로그 보관은 **약 1시간**이다
 * (`--since 7d`를 줘도 38건·최고령 51분, 4일 전은 400). 결제 사고는 며칠 뒤에
 * 발견되므로 **console만으로는 구조적으로 항상 늦는다.**
 *
 * 그래서 보관 기간을 우리 것으로 만든다. 선례는 `notifications` 테이블이다 —
 * 시도를 행으로 남기고 성공/실패를 기록하는 그 모양을 그대로 따른다.
 *
 * 🔴 규칙 세 가지
 * 1. **본 흐름을 막지 않는다.** 이 함수는 절대 throw하지 않는다. 기록 실패가
 *    결제 처리를 중단시키면 그게 더 큰 사고다
 * 2. **호출부는 `next/server`의 `after()`로 감싼다.** `void promise()`는 Vercel
 *    람다 freeze로 유실된다 (2026-08-17 Preview 실측 13분 지연)
 * 3. **개인정보를 넣지 않는다.** 전화·이메일·실명 금지. payment_id와 UUID까지만
 *
 * 테이블이 아직 없어도(마이그레이션 미실행) 이 함수는 console.error만 남기고
 * 조용히 끝난다 — 즉 **웹훅 수정은 prod SQL 실행 순서에 묶이지 않는다.**
 */

import { createServiceClient } from '@/lib/supabase/admin'

/** 어느 경로에서 실패했나. 두 경로 다 결제 후 신청을 만드는 길이다. */
export type PaymentFailureSource =
  /** PortOne 웹훅 (백업 경로) */
  | 'webhook'
  /** 브라우저 redirect → POST /api/registrations/confirm (1차 경로) */
  | 'confirm'

/**
 * 무엇이 실패했나.
 *
 * DB에 CHECK 제약을 두지 않았다 — 이 테이블의 목적은 **행을 절대 잃지 않는 것**이고,
 * CHECK는 새 단계가 생겼을 때 INSERT를 거절해 기록을 지워 버린다. 오타 방어는
 * 이 TypeScript 유니온이 컴파일 시점에 한다 (`notifications`와 다른 선택. 이유는 위와 같다).
 */
export type PaymentFailureStage =
  /** paymentId가 `jdkh-{meetingId8}-{userId8}-{ts}` 형식이 아니다 */
  | 'payment_id_malformed'
  /** 🔴 meetings/profiles prefix 조회 자체가 실패 — 2026-09-10 사고의 지점 */
  | 'id_lookup_failed'
  /** 조회는 정상인데 해당 모임/회원 행이 없다 */
  | 'id_lookup_empty'
  /** 🔴 prefix 하나에 행이 둘 이상 — 누구 결제인지 확정 불가. 추측하지 않고 멈춘 건 */
  | 'id_lookup_ambiguous'
  /** 결제 확정 로직이 신청을 만들지 못하고 끝났다 (금액 불일치·마감·중복 등) */
  | 'confirm_rejected'
  /** 라우트에서 예상 못 한 예외 */
  | 'unhandled_exception'
  /**
   * 🔴 **이것은 실패가 아니다. 막아낸 기록이다.**
   *
   * 같은 `paymentId`로 확정 요청이 **거의 동시에 두 번** 들어왔고, `payment.ts`의
   * Layer 3가 *"그 신청은 바로 이 결제로 만들어진 것"*임을 확인해 **환불하지 않고**
   * 성공으로 응답한 건이다. 회원 돈은 나가지 않았고 신청도 1건만 남았다.
   *
   * 다음 사람에게 — 이 행이 보여도 **사고 대응을 시작하지 마라.** 쌓이는 것이 정상이고,
   * 쌓여야 *"누가 두 번 보내는지"*(`detail`의 `ua=`)를 알 수 있다. 서버 로그 보관이
   * 약 1시간이라 이 표 말고는 남을 곳이 없어서 여기에 둔 것이다.
   * 설계: `docs/agent-team/2026-10-06-중복호출-관찰계획.md`
   *
   * 🔴 보고서에서도 사고 건수와 섞지 않는다 — `payment-failure-report.ts`의
   * `OBSERVATION_STAGES`가 이 단계를 「관찰」로 갈라낸다. 상시 점등된 경고는 아무도 안 본다.
   *
   * ⚠️ Layer 1(시간이 떨어진 정상 재요청)은 **여기 남기지 않는다.** 섞으면 단서가 사라진다.
   */
  | 'duplicate_call_blocked'

export type PaymentFailureInput = {
  source: PaymentFailureSource
  stage: PaymentFailureStage
  paymentId: string
  /** 알아냈을 때만. 못 알아낸 것이 실패 원인인 경우가 많다 */
  meetingId?: string | null
  userId?: string | null
  /** 원문 에러 / 판정 근거. 개인정보 금지 */
  detail?: string | null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * UUID 컬럼에 넣어도 안전한 값만 통과시킨다.
 *
 * confirm 라우트의 `meetingId`는 클라이언트가 보낸 값이라 UUID가 아닐 수 있다.
 * 그대로 INSERT하면 `22P02 invalid input syntax for type uuid`로 **행 전체가 버려진다** —
 * 하필 가장 수상한 요청의 기록이 사라지는 셈이다. 그래서 포맷이 깨진 값은
 * null로 돌리고 원문은 detail에 붙여 남긴다.
 */
export function safeUuid(value: string | null | undefined): { uuid: string | null; note: string | null } {
  if (!value) return { uuid: null, note: null }
  if (UUID_RE.test(value)) return { uuid: value, note: null }
  return { uuid: null, note: `비정상 UUID 입력: ${value.slice(0, 64)}` }
}

/**
 * 실패 1건 기록. **절대 throw하지 않는다.**
 *
 * @example
 *   after(recordPaymentFailure({ source: 'webhook', stage: 'id_lookup_failed', paymentId, detail }))
 */
export async function recordPaymentFailure(input: PaymentFailureInput): Promise<void> {
  try {
    const meeting = safeUuid(input.meetingId)
    const user = safeUuid(input.userId)
    const detail = [input.detail, meeting.note, user.note].filter(Boolean).join(' | ') || null

    const supabase = createServiceClient()
    const { error } = await supabase.from('payment_failures').insert({
      source: input.source,
      stage: input.stage,
      payment_id: input.paymentId,
      meeting_id: meeting.uuid,
      user_id: user.uuid,
      detail,
    })
    if (error) {
      // 여기까지 오면 남길 곳이 console뿐이다. 최소한 원문은 남긴다.
      console.error(
        `[payment-failure] 기록 실패 (${input.source}/${input.stage}, ${input.paymentId}):`,
        error.message,
      )
    }
  } catch (e) {
    console.error(
      `[payment-failure] 기록 중 예외 (${input.source}/${input.stage}, ${input.paymentId}):`,
      e,
    )
  }
}

/**
 * User-Agent 기록 상한.
 *
 * 길면 `detail` 칸을 잡아먹는다. 반대로 너무 짧으면 **아무것도 가를 수 없다** — 카카오톡 인앱
 * 브라우저는 UA 맨 뒤에 `KAKAOTALK x.y.z`를 붙이므로, 앞부분만 남기면 정작 가르고 싶은
 * 클라이언트 종류가 잘려 나간다. 200자면 모바일 UA 전체가 들어간다.
 */
export const USER_AGENT_MAX = 200

/**
 * 「막아낸 중복 호출」 1건 기록 — 🔴 **사고 기록이 아니다.**
 * (`duplicate_call_blocked` 단계 주석을 먼저 읽을 것)
 *
 * 왜 라우트가 부르고 `payment.ts`가 안 부르나 — `payment.ts`는 라이브러리 계층이라
 * **요청 헤더를 모른다.** User-Agent를 아는 것은 라우트뿐이다. 그래서 `payment.ts`는
 * `ConfirmResult.duplicateCallBlocked`로 *신호만* 내보내고, 기록은 라우트가 한다.
 *
 * 🔴 호출부는 반드시 `after()`로 감쌀 것 — `void promise()`는 Vercel 람다 freeze로 유실된다.
 * 이 함수는 `recordPaymentFailure`를 그대로 쓰므로 **절대 throw하지 않는다**(규칙 1).
 *
 * @example
 *   after(recordDuplicateCallBlocked({ source: 'confirm', paymentId, userAgent: request.headers.get('user-agent') }))
 */
export function recordDuplicateCallBlocked(input: {
  source: PaymentFailureSource
  paymentId: string
  meetingId?: string | null
  userId?: string | null
  /** 요청 헤더의 `user-agent`. 🔴 개인정보가 아니라 **클라이언트 종류**라 허용된다 */
  userAgent: string | null | undefined
}): Promise<void> {
  // 「두 호출의 간격」은 일부러 기록하지 않는다 — `registrations.created_at`과 이 행의
  // `created_at`을 빼면 나온다. 같은 사실을 두 곳에 적으면 한쪽이 틀리기 시작한다.
  const flat = (input.userAgent ?? '').replace(/\s+/g, ' ').trim()
  const ua = flat.length === 0 ? '(없음)' : flat.slice(0, USER_AGENT_MAX)

  return recordPaymentFailure({
    source: input.source,
    stage: 'duplicate_call_blocked',
    paymentId: input.paymentId,
    meetingId: input.meetingId,
    userId: input.userId,
    detail: `ua=${ua}`,
  })
}
