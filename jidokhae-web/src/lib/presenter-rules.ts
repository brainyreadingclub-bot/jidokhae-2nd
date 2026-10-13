/**
 * 토론모임 「발제자 지정」 판정 — 순수 함수만 둔다 (client 번들 안전, Supabase·PortOne import 없음).
 *
 * 결정: 검토문서/DECISIONS.md 2026-10-13 「발제자 지정」 + 같은 날 대표님 확정 11건
 * 설계: docs/agent-team/조사/2026-10-13-발제자지정-설계.md §2~§6
 *
 * 발제자 = 운영자가 고른 회원 한 명의 **0원 「신청 완료」** 행(`confirmed` · `payment_method='none'`).
 * 정원 한 자리를 차지하고, 리마인드·발제 공개 알림·답변은 일반 신청자와 같은 길로 돈다.
 * 회원 화면에는 일반 신청자와 똑같이 보인다 — 발제자 표시는 운영자 화면에만.
 *
 * 🔴 이 파일의 갈래(planMoney)와 SQL `assign_presenter`의 CASE는 **같은 표를 두 번 적은 것**이다.
 *    한쪽만 바꾸면 확인 창이 거짓말을 한다(창에는 「환불 대기」, 장부에는 0).
 *    바꿀 때는 `migration-discussion-presenter.sql` §2와 `__tests__/presenter-rules.test.ts`를 같이 고친다.
 */

/** 발제자 행의 결제수단 — 「결제 없음」. DB CHECK가 이 값은 발제자 행에만 허용한다 */
export const PRESENTER_PAYMENT_METHOD = 'none'

/**
 * 이 신청 행이 발제자 행인가.
 *
 * `payment_method === 'none'`으로 가린다 — DB CHECK 두 개가 `'none'` ⇔ `is_presenter`를 묶으므로
 * (`registrations_presenter_no_money_check` · `registrations_none_only_presenter_check`) 둘은 같은 뜻이다.
 * 왜 `is_presenter`를 직접 안 읽나 — **SQL을 아직 안 돌린 prod에서도 화면이 안 깨지게.**
 * `select('…, is_presenter')`는 칸이 없으면 쿼리 전체가 실패한다. `payment_method`는 원래 있는 칸이다.
 */
export function isPresenterRow(r: {
  payment_method?: string | null
  is_presenter?: boolean | null
}): boolean {
  return r.is_presenter === true || r.payment_method === PRESENTER_PAYMENT_METHOD
}

/** 후보의 「살아 있는」 신청 한 건 (confirmed · pending_transfer · waitlisted) */
export type PresenterCandidate = {
  registrationId: string
  status: 'confirmed' | 'pending_transfer' | 'waitlisted'
  paymentMethod: string
  paidAmount: number
  /** 살아 있는 행은 원래 NULL이다. 값이 있으면 장부가 평소와 다르다 → 멈춘다 */
  refundedAmount: number | null
  hasPaymentId: boolean
}

/**
 * 돈 갈래. 설계서 §3-1 표 + 대표님 확정 ⑦(입금 대기는 「통장에 입금이 들어왔나요?」를 묻는다).
 *
 * | 갈래 | 후보 | 돈 | 기존 행 refunded_amount |
 * |---|---|---|---|
 * | none | 신청 없음 | 없음 | (행 없음) |
 * | zero_paid | confirmed · 0원 | 없음 | 0 |
 * | card_full_refund | confirmed · 카드 · 유료 | PortOne 전액 취소 | paid |
 * | waitlist_card_refund | waitlisted · 카드 · 유료 | PortOne 전액 취소 | paid |
 * | card_already_refunded | 카드 유료인데 PortOne이 이미 CANCELLED (재시도 자리) | 안 부른다 | paid |
 * | transfer_manual_refund | confirmed · 계좌이체 · 유료 | 운영자 손 송금 | **NULL** (환불 대기) |
 * | pending_deposited | pending_transfer + 「입금 들어왔다」 | 운영자 손 송금 | **NULL** (환불 대기) |
 * | pending_no_money | pending_transfer + 「안 들어왔다」 (또는 0원) | 없음 | 0 |
 * | waitlist_no_money | waitlisted · 계좌이체 (0원·is_free만 존재) | 없음 | 0 (`waitlist.ts`와 같다) |
 *
 * 🔴 0과 NULL은 뜻이 반대다 — 0 = 받은 돈 없음 / NULL = 운영자가 손으로 돌려줄 돈이 있음.
 */
export type MoneyKind =
  | 'none'
  | 'zero_paid'
  | 'card_full_refund'
  | 'waitlist_card_refund'
  | 'card_already_refunded'
  | 'transfer_manual_refund'
  | 'pending_deposited'
  | 'pending_no_money'
  | 'waitlist_no_money'

export type MoneyPlan =
  | {
      ok: true
      kind: MoneyKind
      /** 회원에게 돌아갈 금액 (카드 자동 / 계좌 손 송금). 0이면 돌려줄 돈 없음 */
      refundAmount: number
      /** 이 지정이 PortOne 전액 취소를 불러야 하는가 */
      callPortone: boolean
      /** 기존 행을 닫을 때 적을 refunded_amount. null = 「환불 대기」. 후보가 없으면 의미 없음 */
      closeRefundedAmount: number | null
    }
  | {
      ok: false
      /** deposit_answer_required = 입금 대기 회원인데 운영자가 아직 입금 여부를 안 골랐다 */
      reason: 'deposit_answer_required' | 'ledger_irregular' | 'card_no_payment_id'
    }

export function planMoney(
  candidate: PresenterCandidate | null,
  opts: {
    /** PortOne이 이 결제를 이미 CANCELLED로 본다 (카드 유료 건만 의미 있음) */
    portoneCancelled?: boolean
    /** 입금 대기 회원 — 「통장에 입금이 들어왔나요?」의 답. 묻기 전이면 undefined/null */
    pendingDeposited?: boolean | null
  } = {},
): MoneyPlan {
  if (!candidate) {
    return { ok: true, kind: 'none', refundAmount: 0, callPortone: false, closeRefundedAmount: null }
  }
  // 살아 있는 행에 환불액이 이미 적혀 있으면 장부가 평소와 다르다 (2026-10-06 장부 정리분 같은 행).
  // 추측해서 덮지 않고 멈춘다 — RPC도 `refunded_amount IS NULL`을 WHERE에 걸어 같은 자리에서 멈춘다.
  if (candidate.refundedAmount !== null) return { ok: false, reason: 'ledger_irregular' }

  const paid = Math.max(0, candidate.paidAmount)

  if (candidate.status === 'pending_transfer') {
    if (paid === 0) {
      return { ok: true, kind: 'pending_no_money', refundAmount: 0, callPortone: false, closeRefundedAmount: 0 }
    }
    if (opts.pendingDeposited === true) {
      return { ok: true, kind: 'pending_deposited', refundAmount: paid, callPortone: false, closeRefundedAmount: null }
    }
    if (opts.pendingDeposited === false) {
      return { ok: true, kind: 'pending_no_money', refundAmount: 0, callPortone: false, closeRefundedAmount: 0 }
    }
    return { ok: false, reason: 'deposit_answer_required' }
  }

  if (candidate.status === 'waitlisted') {
    // 계좌이체 대기는 입금 단계가 없다(0원·is_free만 대기 가능) — waitlist.ts 대기 취소와 같은 0
    if (candidate.paymentMethod === 'transfer' || paid === 0) {
      return { ok: true, kind: 'waitlist_no_money', refundAmount: 0, callPortone: false, closeRefundedAmount: 0 }
    }
    if (!candidate.hasPaymentId) return { ok: false, reason: 'card_no_payment_id' }
    if (opts.portoneCancelled) {
      return { ok: true, kind: 'card_already_refunded', refundAmount: paid, callPortone: false, closeRefundedAmount: paid }
    }
    return { ok: true, kind: 'waitlist_card_refund', refundAmount: paid, callPortone: true, closeRefundedAmount: paid }
  }

  // confirmed
  if (paid === 0) {
    return { ok: true, kind: 'zero_paid', refundAmount: 0, callPortone: false, closeRefundedAmount: 0 }
  }
  if (candidate.paymentMethod === 'transfer') {
    return { ok: true, kind: 'transfer_manual_refund', refundAmount: paid, callPortone: false, closeRefundedAmount: null }
  }
  if (!candidate.hasPaymentId) return { ok: false, reason: 'card_no_payment_id' }
  if (opts.portoneCancelled) {
    return { ok: true, kind: 'card_already_refunded', refundAmount: paid, callPortone: false, closeRefundedAmount: paid }
  }
  return { ok: true, kind: 'card_full_refund', refundAmount: paid, callPortone: true, closeRefundedAmount: paid }
}

/** 카드 환불이 끝났음을 RPC에 알려야 하는 갈래 (RPC는 PortOne을 못 부른다) */
export function needsCardRefundDone(kind: MoneyKind): boolean {
  return kind === 'card_full_refund' || kind === 'waitlist_card_refund' || kind === 'card_already_refunded'
}

export type SeatPlan = {
  allowed: boolean
  /** 후보가 새 자리를 쓰는가 (신청 없음 · 대기). 이미 자리를 가진 회원이면 false — 자리 수 그대로 */
  takesNewSeat: boolean
  remainingBefore: number
  remainingAfter: number
}

/**
 * 자리 셈 — 다른 RPC들과 같이 `confirmed + pending_transfer`를 센다.
 * 이미 자리를 가진 회원(confirmed·pending_transfer)을 바꾸면 **자기 자리를 옮기는 것**이라
 * 정원이 차 있어도 허용한다 (대표님 확정 ⑧). SQL `assign_presenter` 4단계와 같은 식이다.
 */
export function planSeat(input: {
  capacity: number
  seatedCount: number
  candidateStatus: PresenterCandidate['status'] | null
}): SeatPlan {
  const takesNewSeat =
    input.candidateStatus !== 'confirmed' && input.candidateStatus !== 'pending_transfer'
  const others = input.seatedCount - (takesNewSeat ? 0 : 1)
  return {
    allowed: others < input.capacity,
    takesNewSeat,
    remainingBefore: Math.max(0, input.capacity - input.seatedCount),
    remainingAfter: Math.max(0, input.capacity - (others + 1)),
  }
}

/** 지정 전에 막히는 이유. 문구는 PRESENTER_MESSAGES */
export type PresenterBlockReason =
  | 'not_found'
  | 'not_discussion'
  | 'not_active'
  | 'meeting_passed'
  | 'presenter_exists'
  | 'already_presenter'
  | 'ambiguous'
  | 'capacity_full'
  | 'query_failed'
  | 'deposit_answer_required'
  | 'ledger_irregular'
  | 'card_no_payment_id'

/** 모임 자체가 지정을 받을 수 있는가 — RPC 1단계와 같은 순서 */
export function meetingBlock(
  meeting: { status: string; meeting_type: string | null; date: string } | null,
  kstToday: string,
): PresenterBlockReason | null {
  if (!meeting) return 'not_found'
  if (meeting.status !== 'active') return 'not_active'
  if (meeting.meeting_type !== 'discussion') return 'not_discussion'
  if (meeting.date < kstToday) return 'meeting_passed'
  return null
}

/**
 * 운영자에게 보여줄 문구 — 막힘 이유 + RPC 결과. 금액에 「원」을 붙이지 않는다.
 * 정원 문구는 결정 그대로다(DECISIONS 2026-10-13).
 */
export const PRESENTER_MESSAGES: Record<string, string> = {
  not_found: '모임을 찾을 수 없어요',
  not_discussion: '토론모임에만 발제자를 정할 수 있어요',
  not_active: '진행 중인 모임이 아니에요',
  meeting_passed: '지난 모임이에요',
  presenter_exists: '이미 발제자가 있어요. 먼저 빼고 다시 지정하세요',
  already_presenter: '이미 이 모임의 발제자예요',
  ambiguous: '이 회원의 신청이 두 건 이상이라 고를 수 없어요. 신청 내역을 먼저 정리해 주세요',
  capacity_full: '정원이 찼어요. 정원을 늘리거나 자리가 나면 지정하세요',
  query_failed: '잠시 후 다시 시도해 주세요',
  deposit_answer_required: '입금이 들어왔는지 먼저 골라 주세요',
  ledger_irregular: '이 신청의 환불 기록이 평소와 달라요. 정산 화면에서 먼저 확인해 주세요',
  card_no_payment_id: '카드 결제 번호가 없어 자동 환불을 할 수 없어요. 운영자에게 확인해 주세요',
  state_changed: '그 사이 신청 상태가 바뀌었어요. 다시 확인해 주세요',
  refund_required: '카드 환불이 먼저 끝나야 해요. 다시 시도해 주세요',
  refund_failed: '환불이 안 돼서 아무것도 바꾸지 않았어요. 잠시 후 다시 시도해 주세요',
  refunded_but_not_switched: '환불은 끝났고 발제자 전환이 안 됐어요. 다시 누르면 마무리돼요',
  capacity_full_refunded: '자리가 방금 찼어요. 대기 신청은 환불됐어요 — 회원께 연락해 주세요',
  not_presenter: '발제자 신청을 찾을 수 없어요. 새로고침해 주세요',
  not_ready: '발제자 지정은 아직 준비 중이에요 (DB 작업 전). 아무것도 바뀌지 않았어요',
}

export function presenterMessage(code: string): string {
  return PRESENTER_MESSAGES[code] ?? '잠시 후 다시 시도해 주세요'
}

// ─── 지정 실행 순서 (PortOne → RPC) ───
// 라우트에서 떼어 둔 이유 — 「PortOne이 실패했는데 RPC를 부르는」 실수를 단위 테스트로 막으려고.
// PortOne은 HTTP라 DB 트랜잭션 안에서 부를 수 없다. 그래서 **환불 먼저, 성공해야 RPC.**
// 실패하면 아무것도 안 바뀐다. RPC가 실패하면 「자리 유지 + 돈 돌려받음」으로 멈추고
// 다시 누르면 미리보기가 card_already_refunded로 읽어 PortOne 없이 RPC만 부른다
// (설계서 §3-3 — 「돈도 신청도 없는」 상태는 어느 갈래에서도 생기지 않는다).

export type AssignDeps = {
  /**
   * `assign_presenter` RPC가 부를 수 있는 상태인가. 🔴 **PortOne보다 먼저 확인한다** —
   * SQL을 안 돌린 채 코드만 나가면 카드 환불은 되고 전환은 「함수 없음」으로 실패한다.
   * 회원은 돈을 돌려받고 자리를 그대로 가진 채 남는다. 그 상태를 아예 못 만들게 한다
   */
  rpcReady: () => Promise<boolean>
  /** PortOne 전액 취소. 실패하면 throw */
  cancelPayment: () => Promise<void>
  /** PortOne 상태. 조회 실패면 null */
  getPaymentStatus: () => Promise<string | null>
  /** assign_presenter RPC. DB 오류면 { error } */
  callAssignRpc: (cardRefunded: boolean) => Promise<{ result: string } | { error: string }>
}

export type AssignOutcome =
  | { status: 'success' }
  /** DB 작업(마이그레이션) 전 — 아무것도 안 했다 */
  | { status: 'not_ready' }
  /** PortOne 환불 실패 — 아무것도 안 바뀌었다 */
  | { status: 'refund_failed' }
  /** RPC가 거절 — 돈은 안 움직였다 */
  | { status: 'rejected'; result: string }
  /** 🔴 돈은 돌려줬는데 발제자 전환이 안 됐다 — 기록 남기고 재시도 안내 */
  | { status: 'refunded_but_not_switched'; result: string }
  /** 대기 카드 건 — 환불 뒤 자리가 참. RPC가 대기 행을 닫았다 (돈 없이 승격되는 것을 막는다) */
  | { status: 'capacity_full_refunded' }

export async function runPresenterAssign(kind: MoneyKind, deps: AssignDeps): Promise<AssignOutcome> {
  if (!(await deps.rpcReady())) return { status: 'not_ready' }
  let moneyMoved = false
  if (kind === 'card_full_refund' || kind === 'waitlist_card_refund') {
    try {
      await deps.cancelPayment()
      moneyMoved = true
    } catch {
      // 동시에 다른 요청이 이미 취소했을 수 있다 — cancel.ts와 같은 확인
      const st = await deps.getPaymentStatus()
      if (st !== 'CANCELLED') return { status: 'refund_failed' }
      moneyMoved = true
    }
  }
  const cardRefunded = moneyMoved || kind === 'card_already_refunded'

  const rpc = await deps.callAssignRpc(cardRefunded)
  const result = 'error' in rpc ? 'db_error' : rpc.result
  if (result === 'success') return { status: 'success' }
  if (result === 'capacity_full_refunded') return { status: 'capacity_full_refunded' }
  if (cardRefunded) return { status: 'refunded_but_not_switched', result }
  return { status: 'rejected', result }
}

/**
 * 빼면 누가 자리를 받나 — 확인 창 문구용. `promote_next_waitlisted`의 5단계 분기와 같다:
 * 카드 · 0원 계좌이체 = 바로 확정(승격 알림톡) / 금액 있는 계좌이체 = 입금 확인 중(알림톡 없음).
 */
export function firstWaitlistedGoesConfirmed(w: { payment_method: string | null; paid_amount: number | null }): boolean {
  return w.payment_method !== 'transfer' || (w.paid_amount ?? 0) === 0
}

/**
 * 회원 검색어 정리 — PostgREST `or=(…ilike…)` 문법을 깨는 글자를 뺀다.
 * 쉼표·괄호는 조건 구분자, `%`·`*`는 와일드카드, 따옴표·역슬래시는 이스케이프라 그대로 넣으면
 * 남의 조건을 끼워 넣을 수 있다. 빈 문자열이면 검색하지 않는다.
 */
export function sanitizeMemberQuery(q: string | null | undefined): string {
  return (q ?? '')
    .replace(/[,()*%\\"'.:]/g, ' ')
    .trim()
    .slice(0, 20)
}
