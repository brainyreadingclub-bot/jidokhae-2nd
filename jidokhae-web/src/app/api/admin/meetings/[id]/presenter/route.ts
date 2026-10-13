import { NextResponse, after, type NextRequest } from 'next/server'
import { requireAdminRoute } from '@/lib/admin-route'
import { isPresenterRpcReady, loadPresenterPreview, toClientPreview } from '@/lib/presenter'
import { presenterMessage, runPresenterAssign, type MoneyKind } from '@/lib/presenter-rules'
import { cancelPayment, getPayment } from '@/lib/portone'
import { promoteNextWaitlisted } from '@/lib/waitlist'
import { recordPaymentFailure } from '@/lib/payment-failure'

type Params = { params: Promise<{ id: string }> }

/**
 * 토론모임 발제자 지정·빼기 (2026-10-13 대표님 결정). **총괄운영자(admin)만** — 카드 전액 환불이
 * 함께 일어날 수 있는 동작이라 모임 삭제·정산과 같은 권한이다 (대표님 확정 ⑤).
 *
 * GET  ?userId=…[&pendingDeposited=yes|no]  → 확인 창용 미리보기 (읽기만)
 * POST { action: 'assign', userId, expected…, pendingDeposited? }  → 지정
 * POST { action: 'unassign', registrationId }                        → 빼기 + 첫 대기자 자동 확정
 *
 * 지정은 알림톡을 보내지 않는다 (대표님 확정 ①). 빼기 뒤 승격 알림톡은 기존 승격 경로 그대로 (확정 ②).
 * 설계: docs/agent-team/조사/2026-10-13-발제자지정-설계.md §3
 */
export async function GET(request: NextRequest, { params }: Params) {
  const ctx = await requireAdminRoute(request)
  if ('error' in ctx) return ctx.error
  const { id: meetingId } = await params
  const sp = request.nextUrl.searchParams
  const userId = sp.get('userId')
  if (!userId) {
    return NextResponse.json({ status: 'error', message: '회원을 골라 주세요' }, { status: 400 })
  }
  // DB 작업 전이면 확인 창을 열기 전에 알린다 (실행 때도 runPresenterAssign이 다시 막는다)
  if (!(await isPresenterRpcReady(ctx.admin))) {
    return NextResponse.json(
      { status: 'error', code: 'not_ready', message: presenterMessage('not_ready') },
      { status: 503 },
    )
  }
  const preview = await loadPresenterPreview(ctx.admin, meetingId, userId, {
    pendingDeposited: parseDeposited(sp.get('pendingDeposited')),
  })
  if (!preview.ok) {
    return NextResponse.json(
      { status: 'error', code: preview.reason, message: presenterMessage(preview.reason) },
      { status: preview.reason === 'query_failed' ? 500 : 400 },
    )
  }
  return NextResponse.json({ status: 'success', data: toClientPreview(preview) })
}

export async function POST(request: NextRequest, { params }: Params) {
  const ctx = await requireAdminRoute(request)
  if ('error' in ctx) return ctx.error
  const { id: meetingId } = await params

  let body: {
    action?: string
    userId?: string
    registrationId?: string
    expectedRegistrationId?: string | null
    expectedKind?: MoneyKind
    expectedRefundAmount?: number
    pendingDeposited?: boolean | null
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ status: 'error', message: '잘못된 요청입니다' }, { status: 400 })
  }

  if (body.action === 'unassign') return unassign(ctx.admin, meetingId, body.registrationId)
  if (body.action !== 'assign') {
    return NextResponse.json({ status: 'error', message: '잘못된 요청입니다' }, { status: 400 })
  }
  if (!body.userId) {
    return NextResponse.json({ status: 'error', message: '회원을 골라 주세요' }, { status: 400 })
  }

  // 1. 서버에서 다시 계산 — 화면이 본 것과 다르면 아무것도 하지 않는다
  const plan = await loadPresenterPreview(ctx.admin, meetingId, body.userId, {
    pendingDeposited: typeof body.pendingDeposited === 'boolean' ? body.pendingDeposited : null,
  })
  if (!plan.ok) {
    return NextResponse.json(
      { status: 'error', code: plan.reason, message: presenterMessage(plan.reason) },
      { status: plan.reason === 'query_failed' ? 500 : 400 },
    )
  }
  if (!plan.money) {
    return NextResponse.json(
      { status: 'error', code: 'deposit_answer_required', message: presenterMessage('deposit_answer_required') },
      { status: 400 },
    )
  }
  const expectedRegId = body.expectedRegistrationId ?? null
  const currentRegId = plan.candidate?.registrationId ?? null
  // 🔴 금액·갈래까지 대조한다 — 창에 「환불 대기 25,000」을 보고 눌렀는데 그 사이 카드가 취소돼
  //    다른 갈래가 됐으면, 운영자가 동의한 것과 다른 일이 일어난다
  if (
    expectedRegId !== currentRegId ||
    body.expectedKind !== plan.money.kind ||
    body.expectedRefundAmount !== plan.money.refundAmount
  ) {
    return NextResponse.json(
      { status: 'error', code: 'state_changed', message: presenterMessage('state_changed') },
      { status: 409 },
    )
  }

  // 2. PortOne(카드 갈래만) → RPC. 순서와 멈춤 규칙은 runPresenterAssign 주석
  const paymentId = plan.paymentId
  const outcome = await runPresenterAssign(plan.money.kind, {
    rpcReady: () => isPresenterRpcReady(ctx.admin),
    cancelPayment: async () => {
      if (!paymentId) throw new Error('payment_id 없음')
      // amount 생략 = 전액 취소
      await cancelPayment(paymentId, '발제자 지정 전액 환불')
    },
    getPaymentStatus: async () => {
      if (!paymentId) return null
      try {
        return (await getPayment(paymentId)).status
      } catch {
        return null
      }
    },
    callAssignRpc: async (cardRefunded) => {
      const { data, error } = await ctx.admin.rpc('assign_presenter', {
        p_meeting_id: meetingId,
        p_user_id: plan.userId,
        p_expected_reg_id: currentRegId,
        p_card_refunded: cardRefunded,
        p_pending_deposited: typeof body.pendingDeposited === 'boolean' ? body.pendingDeposited : null,
      })
      if (error) return { error: error.message }
      const row = (data as { result: string }[] | null)?.[0]
      return row ? { result: row.result } : { error: 'empty' }
    },
  })

  if (outcome.status === 'success') {
    return NextResponse.json({ status: 'success' })
  }
  if (outcome.status === 'refunded_but_not_switched' || outcome.status === 'capacity_full_refunded') {
    // 돈이 나간 뒤 멈춘 자리 — 서버 로그는 약 1시간이라 우리 표에 남긴다 (절대 throw 안 함)
    after(
      recordPaymentFailure({
        source: 'presenter',
        stage: 'presenter_swap_db_failed',
        paymentId: paymentId ?? 'unknown',
        meetingId,
        userId: plan.userId,
        detail: `${outcome.status}${'result' in outcome ? ` / rpc=${outcome.result}` : ''} / reg=${currentRegId}`,
      }),
    )
    return NextResponse.json(
      { status: 'error', code: outcome.status, message: presenterMessage(outcome.status) },
      { status: outcome.status === 'capacity_full_refunded' ? 409 : 500 },
    )
  }
  if (outcome.status === 'not_ready') {
    return NextResponse.json(
      { status: 'error', code: 'not_ready', message: presenterMessage('not_ready') },
      { status: 503 },
    )
  }
  if (outcome.status === 'refund_failed') {
    return NextResponse.json(
      { status: 'error', code: 'refund_failed', message: presenterMessage('refund_failed') },
      { status: 502 },
    )
  }
  // rejected — 돈은 안 움직였다
  console.error('[presenter] assign_presenter 거절:', outcome.result)
  return NextResponse.json(
    { status: 'error', code: outcome.result, message: presenterMessage(outcome.result) },
    { status: outcome.result === 'db_error' ? 500 : 409 },
  )
}

async function unassign(
  admin: Parameters<typeof loadPresenterPreview>[0],
  meetingId: string,
  registrationId: string | undefined,
) {
  if (!registrationId) {
    return NextResponse.json({ status: 'error', message: '발제자 신청을 찾을 수 없어요' }, { status: 400 })
  }
  const { data, error } = await admin.rpc('unassign_presenter', {
    p_meeting_id: meetingId,
    p_registration_id: registrationId,
  })
  if (error) {
    console.error('[presenter] unassign_presenter 실패:', error)
    return NextResponse.json(
      { status: 'error', message: presenterMessage('query_failed') },
      { status: 500 },
    )
  }
  const result = data as string
  if (result !== 'success') {
    return NextResponse.json(
      { status: 'error', code: result, message: presenterMessage(result) },
      { status: 409 },
    )
  }

  // 자리가 났다 → 첫 대기자 자동 확정 + 승격 알림톡 (취소 라우트와 같은 방식: await, 실패해도 빼기는 유효)
  let promoted = false
  try {
    promoted = (await promoteNextWaitlisted(meetingId)) !== null
  } catch (e) {
    console.error('[presenter] 대기자 승격 실패:', e)
  }
  return NextResponse.json({ status: 'success', data: { promoted } })
}

function parseDeposited(v: string | null): boolean | null {
  if (v === 'yes') return true
  if (v === 'no') return false
  return null
}
