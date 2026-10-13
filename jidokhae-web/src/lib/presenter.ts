/**
 * 토론모임 「발제자 지정」 — 서버 조회 (service_role). 판정은 `presenter-rules.ts`(순수)에.
 *
 * 확인 창과 실행 라우트가 **같은 함수**(`loadPresenterPreview`)를 부른다 — 실행 직전에 서버가
 * 다시 계산해 화면이 본 것과 대조하고, 다르면 아무것도 하지 않는다 (설계서 §3-1·§3-2).
 *
 * 🔴 `is_presenter` 칸을 select하지 않는다 — SQL 실행 전 prod에서도 이 파일의 쿼리가 실패하지 않게.
 *    발제자 행은 `payment_method = 'none'`으로 가린다(`isPresenterRow` 주석).
 */

import type { createServiceClient } from '@/lib/supabase/admin'
import { getPayment } from '@/lib/portone'
import { getKSTToday } from '@/lib/kst'
import { isCurator } from '@/lib/curator'
import { PARTICIPATED_STATUSES } from '@/lib/registration-status'
import { getDiscussionEligibility } from '@/lib/discussion-gate'
import { hasRegularAttendance, type AttendanceRow } from '@/lib/discussion-eligibility'
import {
  PRESENTER_PAYMENT_METHOD,
  meetingBlock,
  planMoney,
  planSeat,
  sanitizeMemberQuery,
  type MoneyKind,
  type PresenterBlockReason,
  type PresenterCandidate,
  type SeatPlan,
} from '@/lib/presenter-rules'

type Admin = ReturnType<typeof createServiceClient>

const LIVE_STATUSES = ['confirmed', 'pending_transfer', 'waitlisted'] as const

export type PresenterPreview =
  | { ok: false; reason: PresenterBlockReason }
  | {
      ok: true
      userId: string
      nickname: string
      realName: string | null
      /** 토론 참여 자격. null = 조회 실패(모름) — 「자격 없음」을 띄우지 않는다 */
      eligible: boolean | null
      candidate: PresenterCandidate | null
      /**
       * null = 입금 대기 회원인데 「통장에 입금이 들어왔나요?」를 아직 안 물었다 (대표님 확정 ⑦).
       * 화면은 먼저 그 질문을 하고, 답을 붙여 다시 미리보기를 받는다. 실행은 답 없이는 거절한다
       */
      money: { kind: MoneyKind; refundAmount: number } | null
      seat: SeatPlan
      /** 🔴 서버 전용 — 응답에 싣지 않는다 (`toClientPreview`) */
      paymentId: string | null
    }

export async function loadPresenterPreview(
  admin: Admin,
  meetingId: string,
  userId: string,
  opts: { pendingDeposited?: boolean | null } = {},
): Promise<PresenterPreview> {
  const [meetingRes, seatedRes, presenterRes, liveRes, profileRes, eligibility] = await Promise.all([
    admin.from('meetings').select('id, capacity, status, meeting_type, date').eq('id', meetingId).maybeSingle(),
    admin
      .from('registrations')
      .select('id', { count: 'exact', head: true })
      .eq('meeting_id', meetingId)
      .in('status', PARTICIPATED_STATUSES),
    admin
      .from('registrations')
      .select('id, user_id')
      .eq('meeting_id', meetingId)
      .eq('status', 'confirmed')
      .eq('payment_method', PRESENTER_PAYMENT_METHOD),
    admin
      .from('registrations')
      .select('id, status, payment_method, paid_amount, refunded_amount, payment_id')
      .eq('meeting_id', meetingId)
      .eq('user_id', userId)
      .in('status', LIVE_STATUSES),
    admin.from('profiles').select('nickname, real_name').eq('id', userId).maybeSingle(),
    getDiscussionEligibility(userId),
  ])

  if (meetingRes.error || seatedRes.error || presenterRes.error || liveRes.error || profileRes.error) {
    return { ok: false, reason: 'query_failed' }
  }
  const meeting = meetingRes.data as
    | { id: string; capacity: number; status: string; meeting_type: string | null; date: string }
    | null
  const mb = meetingBlock(meeting, getKSTToday())
  if (mb || !meeting) return { ok: false, reason: mb ?? 'not_found' }
  if (!profileRes.data) return { ok: false, reason: 'not_found' }

  const presenters = (presenterRes.data ?? []) as { id: string; user_id: string }[]
  if (presenters.some((p) => p.user_id === userId)) return { ok: false, reason: 'already_presenter' }
  if (presenters.length > 0) return { ok: false, reason: 'presenter_exists' }

  const live = (liveRes.data ?? []) as {
    id: string
    status: PresenterCandidate['status']
    payment_method: string
    paid_amount: number | null
    refunded_amount: number | null
    payment_id: string | null
  }[]
  if (live.length > 1) return { ok: false, reason: 'ambiguous' }
  const row = live[0] ?? null
  const candidate: PresenterCandidate | null = row
    ? {
        registrationId: row.id,
        status: row.status,
        paymentMethod: row.payment_method,
        paidAmount: row.paid_amount ?? 0,
        refundedAmount: row.refunded_amount,
        hasPaymentId: !!row.payment_id,
      }
    : null

  // 카드 유료 건 — PortOne이 이미 취소했는지 (재시도 자리). 부분 취소면 장부가 평소와 다르다 → 멈춘다
  let portoneCancelled = false
  if (candidate && row?.payment_id && candidate.paymentMethod === 'card' && candidate.paidAmount > 0) {
    try {
      const payment = await getPayment(row.payment_id)
      if (payment.status === 'PARTIAL_CANCELLED') return { ok: false, reason: 'ledger_irregular' }
      portoneCancelled = payment.status === 'CANCELLED'
    } catch {
      // 조회 실패 = 모른다. 취소 안 된 것으로 두고 실행 때 cancelPayment가 다시 확인한다
      portoneCancelled = false
    }
  }

  const money = planMoney(candidate, { portoneCancelled, pendingDeposited: opts.pendingDeposited })
  if (!money.ok && money.reason !== 'deposit_answer_required') return { ok: false, reason: money.reason }

  const seat = planSeat({
    capacity: meeting.capacity,
    seatedCount: seatedRes.count ?? 0,
    candidateStatus: candidate?.status ?? null,
  })
  if (!seat.allowed) return { ok: false, reason: 'capacity_full' }

  const profile = profileRes.data as { nickname: string | null; real_name: string | null }
  return {
    ok: true,
    userId,
    nickname: profile.nickname || '(이름 없음)',
    realName: profile.real_name,
    eligible:
      eligibility.kind === 'eligible' ? true : eligibility.kind === 'not_eligible' ? false : null,
    candidate,
    money: money.ok ? { kind: money.kind, refundAmount: money.refundAmount } : null,
    seat,
    paymentId: row?.payment_id ?? null,
  }
}

/**
 * 발제자 RPC가 prod에 있는가 — 없는 모임 id로 `assign_presenter`를 불러 본다.
 * 함수는 1단계(모임 잠금)에서 `not_found`로 바로 끝나 **아무것도 쓰지 않는다.**
 * 함수가 없거나 권한이 없으면 오류 → false. 마이그레이션 전 배포에서 카드 환불이 먼저 나가는 것을 막는다
 */
export async function isPresenterRpcReady(admin: Admin): Promise<boolean> {
  const { data, error } = await admin.rpc('assign_presenter', {
    p_meeting_id: NIL_UUID,
    p_user_id: NIL_UUID,
    p_expected_reg_id: null,
    p_card_refunded: false,
    p_pending_deposited: null,
  })
  if (error) return false
  return (data as { result: string }[] | null)?.[0]?.result === 'not_found'
}

const NIL_UUID = '00000000-0000-0000-0000-000000000000'

/** 응답에 싣는 모양 — payment_id를 뺀다 */
export function toClientPreview(p: PresenterPreview) {
  if (!p.ok) return p
  const { paymentId: _omit, ...rest } = p
  void _omit
  return rest
}

export type PresenterSearchRow = {
  userId: string
  nickname: string
  realName: string | null
  /** null = 조회 실패(모름) */
  eligible: boolean | null
}

/**
 * 「신청 안 한 회원」 찾기 — 닉네임 또는 실명. 실명은 admin만 보는 화면이다(라우트가 admin만 통과).
 * 자격은 표시용이다 — 자격이 없어도 지정할 수 있다 (대표님 확정 ③).
 */
export async function searchMembersForPresenter(
  admin: Admin,
  rawQuery: string,
): Promise<{ ok: true; rows: PresenterSearchRow[] } | { ok: false }> {
  const q = sanitizeMemberQuery(rawQuery)
  if (!q) return { ok: true, rows: [] }

  const { data, error } = await admin
    .from('profiles')
    .select('id, nickname, real_name, role, is_staff')
    .or(`nickname.ilike.%${q}%,real_name.ilike.%${q}%`)
    .order('nickname', { ascending: true })
    .limit(20)
  if (error) return { ok: false }
  const profiles = (data ?? []) as {
    id: string
    nickname: string | null
    real_name: string | null
    role: string
    is_staff: boolean | null
  }[]
  if (profiles.length === 0) return { ok: true, rows: [] }

  // 자격 — 한 번에 센다(사람마다 조회하지 않는다). 규칙은 discussion-eligibility.ts 그대로
  const { data: regs, error: regsError } = await admin
    .from('registrations')
    .select('user_id, status, meetings(date, meeting_type, status)')
    .in('user_id', profiles.map((p) => p.id))
    .in('status', PARTICIPATED_STATUSES)
  const byUser = new Map<string, AttendanceRow[]>()
  for (const r of ((regs ?? []) as unknown as (AttendanceRow & { user_id: string })[])) {
    const list = byUser.get(r.user_id) ?? []
    list.push(r)
    byUser.set(r.user_id, list)
  }
  const today = getKSTToday()

  return {
    ok: true,
    rows: profiles.map((p) => ({
      userId: p.id,
      nickname: p.nickname || '(이름 없음)',
      realName: p.real_name,
      eligible: isCurator(p)
        ? true
        : regsError
          ? null
          : hasRegularAttendance(byUser.get(p.id) ?? [], today),
    })),
  }
}
