/**
 * Shared payment confirmation logic.
 * Used by both POST /api/registrations/confirm and POST /api/webhooks/portone.
 *
 * 포트원 V2 기준 — 결제창에서 완료 시 이미 승인된 상태로 redirect됨.
 * 따라서 confirm 단계는 getPayment로 status === 'PAID' 검증만 수행.
 */

import { createServiceClient } from '@/lib/supabase/admin'
import { getPayment, cancelPayment } from '@/lib/portone'
import { calculateFee, isStaffDiscountableMeetingType } from '@/lib/pricing'
import { isDiscussionApplyOpen } from '@/lib/discussion-rules'

/**
 * 🔴 **옵셔널 필드로만 넓힌다.** 호출부가 여럿(confirm 라우트·웹훅)이라 필수 필드를
 * 더하면 전부 고쳐야 하고, 돈 경로를 건드리는 변경은 적을수록 좋다.
 *
 * `duplicateCallBlocked` — **Layer 3에서만** 붙는다. "같은 결제로 거의 동시에 두 번
 * 들어왔고 환불하지 않고 막았다"는 신호다. 기록은 라우트가 한다(User-Agent를 아는 쪽).
 * ⚠️ **Layer 1에는 붙이지 않는다** — Layer 1은 시간이 떨어진 정상 재요청(멱등)이고,
 * Layer 3가 거의 동시에 들어온 진짜 중복이다. 섞으면 단서가 사라진다.
 */
export type ConfirmResult =
  | { status: 'success'; registrationId: string; duplicateCallBlocked?: true }
  | { status: 'waitlisted'; registrationId: string; duplicateCallBlocked?: true }
  | { status: 'full'; message: string }
  | { status: 'already_registered'; message: string }
  | { status: 'error'; message: string }

type ServiceClient = ReturnType<typeof createServiceClient>

/**
 * `payment_id`로 신청 행을 찾은 결과.
 * 🔴 조회 실패(`query_failed`)와 대상 없음(`none`)을 **절대 합치지 않는다** —
 * 합치면 DB가 잠깐 흔들린 것을 "진짜 중복"으로 읽고 회원 돈을 돌려준다.
 */
type PaymentIdLookup =
  | { kind: 'found'; id: string; status: string }
  | { kind: 'none' }
  | { kind: 'query_failed' }

/**
 * 이 `paymentId`로 만들어진 신청 행을 찾는다 — **멱등성 판정의 단일 기준.**
 *
 * Layer 1(RPC 호출 전)과 Layer 3(`already_registered` 분기)이 둘 다 이 함수를 쓴다.
 * 두 곳이 서로 다른 조건으로 보면 "내 결제인데 남의 중복으로 오판"하는 틈이 다시 생긴다.
 */
async function findRegistrationByPaymentId(
  supabase: ServiceClient,
  paymentId: string,
): Promise<PaymentIdLookup> {
  const { data, error } = await supabase
    .from('registrations')
    .select('id, status')
    .eq('payment_id', paymentId)
    .in('status', ['confirmed', 'waitlisted'])
    .limit(1)

  if (error) return { kind: 'query_failed' }
  if (data && data.length > 0) {
    return { kind: 'found', id: String(data[0].id), status: String(data[0].status) }
  }
  return { kind: 'none' }
}

/**
 * 결제 확정 처리.
 *
 * @param paymentId 포트원 결제 ID (= 우리가 채번한 orderId, 형식: jdkh-{meetingId8}-{userId8}-{ts})
 * @param meetingId 모임 UUID
 * @param userId 사용자 UUID
 *
 * 결제 금액 검증은 서버에서 포트원 응답(totalAmount)을 meeting.fee와 직접 대조.
 * 클라이언트 입력 의존 제거 (포트원 redirect에 amount 미포함).
 */
export async function processPaymentConfirmation(
  paymentId: string,
  meetingId: string,
  userId: string,
): Promise<ConfirmResult> {
  const supabase = createServiceClient()

  // Layer 1: Idempotency — already confirmed or waitlisted with this paymentId?
  const prior = await findRegistrationByPaymentId(supabase, paymentId)

  if (prior.kind === 'found') {
    return prior.status === 'waitlisted'
      ? { status: 'waitlisted', registrationId: prior.id }
      : { status: 'success', registrationId: prior.id }
  }
  // `query_failed`면 여기서 끊지 않고 RPC로 넘어간다 — RPC가 FOR UPDATE 안에서 중복을
  // 다시 막고, 중복으로 판정되면 Layer 3에서 같은 조회를 한 번 더 한다. 여기서 끊으면
  // "결제는 됐는데 신청이 없는" 상태가 된다 (돈 안전성 규칙).

  // Verify meeting exists and is active
  const { data: meeting } = await supabase
    .from('meetings')
    .select('fee, status, meeting_type, date')
    .eq('id', meetingId)
    .single()

  if (!meeting || meeting.status !== 'active') {
    return { status: 'error', message: '신청할 수 없는 모임입니다' }
  }

  // 토론모임 D-7 신청 마감 강제 (2026-08-17 결정) — 마감 후 결제는 취소 후 거절.
  // 화면 버튼은 이미 막지만, 딥링크·공유 URL·마감 직전 결제창 체류 경로를 서버에서 차단.
  if (meeting.meeting_type === 'discussion' && !isDiscussionApplyOpen(meeting.date)) {
    await safeCancel(paymentId, '토론모임 신청 마감(D-7) 이후 결제')
    return { status: 'error', message: '신청이 마감된 모임입니다. 결제는 자동 취소됩니다' }
  }

  // 포트원에서 결제 검증 (이미 결제 완료 상태여야 함)
  let payment
  try {
    payment = await getPayment(paymentId)
  } catch {
    return { status: 'error', message: '결제 검증에 실패했습니다' }
  }

  if (payment.status !== 'PAID') {
    return { status: 'error', message: '결제가 완료되지 않았습니다' }
  }

  // 결제 금액 검증 — 정가 또는 스텝 할인가(50%)만 허용.
  // 스텝 할인은 정기모임 한정 (2026-08-17 결정) — 그 외 유형은 정가만.
  // 자격·슬롯 검증은 RPC가 FOR UPDATE 락 안에서 처리 (race 안전망).
  const allowedAmounts = isStaffDiscountableMeetingType(meeting.meeting_type)
    ? [meeting.fee, calculateFee(meeting.fee, true)]
    : [meeting.fee]
  if (!allowedAmounts.includes(payment.totalAmount)) {
    await safeCancel(paymentId, '결제 금액 불일치')
    return { status: 'error', message: '결제 정보가 일치하지 않습니다' }
  }

  // paymentId prefix ↔ meetingId 교차 검증
  // paymentId 형식: jdkh-{meetingId8}-{userId8}-{timestamp}
  // 공격자가 다른 모임의 paymentId를 이 요청의 meetingId와 섞어 제출한 경우 차단.
  const meetingId8 = meetingId.replace(/-/g, '').slice(0, 8)
  const userId8 = userId.replace(/-/g, '').slice(0, 8)
  const paymentParts = paymentId.split('-')
  if (
    paymentParts.length < 4 ||
    paymentParts[0] !== 'jdkh' ||
    paymentParts[1] !== meetingId8 ||
    // userId8도 교차 검증 — 타인 prefix를 박은 paymentId로 남의 명의 등록 차단 (2026-08-20 스윕)
    paymentParts[2] !== userId8
  ) {
    await safeCancel(paymentId, 'paymentId prefix 불일치 (meeting/user)')
    return { status: 'error', message: '결제 정보가 일치하지 않습니다' }
  }

  // Layer 2: Atomic registration via DB Function
  const { data: result, error: rpcError } = await supabase.rpc(
    'confirm_registration',
    {
      p_user_id: userId,
      p_meeting_id: meetingId,
      p_payment_id: paymentId,
      p_paid_amount: payment.totalAmount,
    },
  )

  if (rpcError) {
    await safeCancel(paymentId, '신청 처리 오류')
    return { status: 'error', message: '신청 처리 중 오류가 발생했습니다' }
  }

  const rpcResult = result as string

  if (rpcResult === 'success') {
    const { data: reg } = await supabase
      .from('registrations')
      .select('id')
      .eq('payment_id', paymentId)
      .eq('status', 'confirmed')
      .limit(1)

    return { status: 'success', registrationId: reg?.[0]?.id ?? '' }
  }

  if (rpcResult === 'waitlisted') {
    // 대기 신청 — 결제 유지, 환불하지 않음
    const { data: reg } = await supabase
      .from('registrations')
      .select('id')
      .eq('payment_id', paymentId)
      .eq('status', 'waitlisted')
      .limit(1)

    return { status: 'waitlisted', registrationId: reg?.[0]?.id ?? '' }
  }

  if (rpcResult === 'full') {
    // 방어 코드 — confirm_registration()이 더 이상 'full' 반환하지 않지만 안전을 위해 유지
    await safeCancel(paymentId, '정원 마감으로 인한 환불')
    return { status: 'full', message: '마감되었습니다' }
  }

  if (rpcResult === 'already_registered') {
    // Layer 3: 환불 전에 "그 신청이 **이 결제로** 만들어진 것인지" 확인한다.
    //
    // 🔴 2026-10-06 사고 수정 — 실피해 6명·72,000.
    //   브라우저가 confirm을 두 번 보내면(카카오톡 인앱 브라우저 복귀 시 재마운트) Layer 1은
    //   락 밖이라 두 요청이 모두 통과하고, RPC의 FOR UPDATE가 둘을 줄 세워 **두 번째가
    //   already_registered**가 된다. 그때 무조건 환불하면 방금 자기가 만든 신청의 돈이
    //   나가고 신청 행은 남는다 → 돈 안 낸 회원이 자리를 차지한다.
    //   조사: docs/agent-team/조사/2026-10-06-중복환불-사고.md
    const mine = await findRegistrationByPaymentId(supabase, paymentId)

    if (mine.kind === 'found') {
      // 내 결제로 만들어진 행이다 → 환불하지 않고 Layer 1과 같은 결과로 응답한다.
      //
      // `duplicateCallBlocked`를 붙여 **막아냈다는 사실만** 내보낸다. 기록은 하지 않는다 —
      // 여기는 라이브러리 계층이라 요청 헤더(User-Agent)를 모르고, 그게 범인을 가리는
      // 유일한 단서다. 기록은 라우트가 `recordDuplicateCallBlocked`로 한다.
      // 설계: docs/agent-team/2026-10-06-중복호출-관찰계획.md
      return mine.status === 'waitlisted'
        ? { status: 'waitlisted', registrationId: mine.id, duplicateCallBlocked: true }
        : { status: 'success', registrationId: mine.id, duplicateCallBlocked: true }
    }

    if (mine.kind === 'query_failed') {
      // 조회 실패를 "대상 없음"과 합치면 돈이 나간다. 환불하지 않고 시끄럽게 끝낸다.
      console.error(
        `[payment] already_registered 재확인 조회 실패 — 환불 보류: ${paymentId}`,
      )
      return {
        status: 'error',
        message: '신청 상태 확인에 실패했습니다. 내 신청 내역을 확인해주세요',
      }
    }

    // 이 결제로 만들어진 행이 없다 = 다른 결제·계좌이체로 이미 신청돼 있다 → 진짜 중복
    await safeCancel(paymentId, '중복 신청으로 인한 환불')
    return { status: 'already_registered', message: '이미 신청한 모임입니다' }
  }

  // 스텝 할인 신규 결과 코드 — 'error'로 흡수, 메시지만 차별화
  if (rpcResult === 'discount_not_eligible') {
    await safeCancel(paymentId, '스텝 할인 자격 없음')
    return { status: 'error', message: '스텝 할인 자격이 없습니다' }
  }

  if (rpcResult === 'staff_slot_full') {
    await safeCancel(paymentId, '스텝 할인 슬롯 마감')
    return {
      status: 'error',
      message: '스텝 할인 슬롯이 마감되어 결제가 취소되었습니다. 정가로 다시 신청해주세요.',
    }
  }

  // not_found, not_active, etc.
  await safeCancel(paymentId, '모임 상태 오류')
  return { status: 'error', message: '신청할 수 없는 모임입니다' }
}

/**
 * Safe cancel — never throws.
 * On refund failure, keep confirmed status (better than no money AND no registration).
 */
async function safeCancel(paymentId: string, reason: string): Promise<void> {
  try {
    await cancelPayment(paymentId, reason)
  } catch (e) {
    console.error(`[payment] Refund failed for ${paymentId}:`, e)
  }
}
