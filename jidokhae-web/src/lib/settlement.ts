import type { SupabaseClient } from '@supabase/supabase-js'
import { getDaysUntil, toKSTDate, getKSTToday } from '@/lib/kst'
import { recommendedTransferRefund } from '@/lib/refund'

export type DepositRow = {
  id: string
  createdAt: string
  paidAmount: number
  meetingId: string | null
  meetingTitle: string
  meetingDate: string
  nickname: string
  realName: string | null
  phone: string | null
  elapsedDays: number
  isStaffDiscount: boolean
}

export type RefundRow = {
  id: string
  cancelledAt: string | null
  /** 돌려줄 금액 — 환불 규정 기준. 「환불 완료」 체크 때 서버가 기록하는 값과 같은 함수(recommendedTransferRefund) */
  refundAmount: number
  /** 회원이 낸 돈 (참고 표시용) */
  paidAmount: number
  meetingId: string | null
  meetingTitle: string | null
  meetingDate: string | null
  nickname: string
  realName: string | null
  phone: string | null
}

export type DepositSort = 'created' | 'amount' | 'meeting'

// 신청 시각(UTC ISO) → 오늘(KST YYYY-MM-DD) 기준 경과 일수
export function elapsedDaysKST(createdAtUTC: string, kstToday: string): number {
  const createdKSTDate = toKSTDate(new Date(createdAtUTC))
  return getDaysUntil(kstToday, createdKSTDate) // today - created = 경과 일수
}

// UTC ISO → "M/D 오전/오후 h:mm" (KST)
export function formatKSTDateTime(utcISO: string): string {
  const kstMs = new Date(utcISO).getTime() + 9 * 60 * 60 * 1000
  const d = new Date(kstMs)
  const month = d.getUTCMonth() + 1
  const day = d.getUTCDate()
  const hour24 = d.getUTCHours()
  const minute = d.getUTCMinutes()
  const meridiem = hour24 >= 12 ? '오후' : '오전'
  let hour12 = hour24 % 12
  if (hour12 === 0) hour12 = 12
  const mm = minute.toString().padStart(2, '0')
  return `${month}/${day} ${meridiem} ${hour12}:${mm}`
}

export function sortDepositRows(rows: DepositRow[], sort: DepositSort): DepositRow[] {
  const copy = [...rows]
  if (sort === 'amount') {
    copy.sort((a, b) => b.paidAmount - a.paidAmount)
  } else if (sort === 'meeting') {
    copy.sort((a, b) => {
      if (a.meetingDate !== b.meetingDate) return a.meetingDate < b.meetingDate ? -1 : 1
      return a.createdAt < b.createdAt ? -1 : 1
    })
  } else {
    // created: 오래된 → 최신
    copy.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
  }
  return copy
}

type RegRow = {
  id: string
  created_at: string
  cancelled_at: string | null
  paid_amount: number | null
  is_staff_discount: boolean
  profiles: { nickname: string | null; real_name: string | null; phone: string | null; is_free: boolean | null } | null
  meetings: { id: string | null; title: string | null; date: string | null } | null
}

// RegRow → DepositRow 변환 (getPendingDeposits / getExcludedDeposits 공용)
function toDepositRow(r: RegRow, kstToday: string): DepositRow {
  return {
    id: r.id,
    createdAt: r.created_at,
    paidAmount: r.paid_amount ?? 0,
    meetingId: r.meetings?.id ?? null,
    meetingTitle: r.meetings?.title ?? '삭제된 모임',
    meetingDate: r.meetings?.date ?? '',
    nickname: r.profiles?.nickname ?? '(알수없음)',
    realName: r.profiles?.real_name ?? null,
    phone: r.profiles?.phone ?? null,
    elapsedDays: elapsedDaysKST(r.created_at, kstToday),
    isStaffDiscount: r.is_staff_discount,
  }
}

// 탭 A: pending_transfer 전체 (모임/프로필 join)
// 무료 회원(is_free)은 코멥이라 입금이 없다 — 입금 확인 대기 목록에서 제외.
// settlement_excluded=true(운영자가 "확인 제외" 처리)도 목록에서 숨긴다.
export async function getPendingDeposits(supabase: SupabaseClient): Promise<DepositRow[]> {
  const { data, error } = await supabase
    .from('registrations')
    .select('id, created_at, paid_amount, is_staff_discount, profiles(nickname, real_name, phone, is_free), meetings(id, title, date)')
    .eq('status', 'pending_transfer')
    .eq('settlement_excluded', false)
    .order('created_at', { ascending: true })

  if (error) throw error
  const kstToday = getKSTToday()

  return ((data ?? []) as unknown as RegRow[])
    .filter((r) => r.profiles?.is_free !== true)
    .map((r) => toDepositRow(r, kstToday))
}

// "확인 제외" 처리된 pending_transfer 건 (최신순) — 정산 화면 하단 복구용
export async function getExcludedDeposits(supabase: SupabaseClient): Promise<DepositRow[]> {
  const { data, error } = await supabase
    .from('registrations')
    .select('id, created_at, paid_amount, is_staff_discount, profiles(nickname, real_name, phone, is_free), meetings(id, title, date)')
    .eq('status', 'pending_transfer')
    .eq('settlement_excluded', true)
    .order('created_at', { ascending: false })

  if (error) throw error
  const kstToday = getKSTToday()

  return ((data ?? []) as unknown as RegRow[]).map((r) => toDepositRow(r, kstToday))
}

// ============================================================
// 지역별 매출 보고서 — 공간대여비 정산 근거
// confirmed(결제 완료) 등록의 paid_amount를 지역별로 집계한다.
// 매출은 "실제 결제된 총액"(gross) — 환불 차감 없음 (앱 대시보드 순매출과 다름).
// 지역 목록은 데이터에서 동적 추출 (하드코딩 금지 — 대구 등 추가 대비).
// ============================================================

// 등록 1건 = 1 entry. 클라이언트가 월별/전체로 그룹핑.
export type RegionRevenueEntry = {
  region: string
  month: string // "YYYY-MM" (meeting.date 기준)
  meetingId: string
  paidAmount: number
}

type RegionRegRow = {
  paid_amount: number | null
  meetings: { id: string | null; region: string | null; date: string | null; status: string | null } | null
}

export async function getRegionRevenueData(supabase: SupabaseClient): Promise<RegionRevenueEntry[]> {
  const { data, error } = await supabase
    .from('registrations')
    .select('paid_amount, meetings(id, region, date, status)')
    .eq('status', 'confirmed')

  if (error) throw error

  const rows = (data ?? []) as unknown as RegionRegRow[]
  const entries: RegionRevenueEntry[] = []
  for (const r of rows) {
    const m = r.meetings
    // active 모임만 집계 — deleting(환불 진행 중)/deleted 제외. getVenueSettlementData 선례와 동일.
    if (!m || !m.id || !m.date || m.status !== 'active') continue
    entries.push({
      region: m.region ?? '미지정',
      month: m.date.slice(0, 7),
      meetingId: m.id,
      paidAmount: r.paid_amount ?? 0,
    })
  }
  return entries
}

type RefundRegRow = {
  id: string
  cancelled_at: string | null
  cancel_type: string | null
  paid_amount: number | null
  profiles: { nickname: string | null; real_name: string | null; phone: string | null } | null
  meetings: { id: string | null; title: string | null; date: string | null; meeting_type: string | null } | null
}

// 탭 B: 환불 대기 (계좌이체 취소 + 미환불 + 실입금)
export async function getPendingRefunds(supabase: SupabaseClient): Promise<RefundRow[]> {
  const { data, error } = await supabase
    .from('registrations')
    .select('id, cancelled_at, cancel_type, paid_amount, profiles(nickname, real_name, phone), meetings(id, title, date, meeting_type)')
    .eq('status', 'cancelled')
    .eq('payment_method', 'transfer')
    .is('refunded_amount', null)
    .gt('paid_amount', 0)
    .order('cancelled_at', { ascending: true })

  if (error) throw error

  // 돌려줄 금액은 「환불 완료」 체크 때 서버(mark-refunded)가 기록하는 값과 같은 함수로 계산한다 —
  // 모임 운영 상세 신청자 표(AdminMeetingSection)도 같은 함수다. 종전에는 낸 돈 전액을 보여 줘서
  // 운영자가 이 숫자대로 송금하면 기록(규정 금액)과 실제 송금액이 어긋날 수 있었다 (2026-10-14 코드 조사 §1-3 6번).
  // 표시만 바꾼다 — 처리 로직·DB 값은 그대로.
  return ((data ?? []) as unknown as RefundRegRow[]).map((r) => {
    const paidAmount = r.paid_amount ?? 0
    const refundAmount = r.meetings?.date
      ? recommendedTransferRefund({
          cancelType: r.cancel_type,
          meetingType: r.meetings.meeting_type,
          meetingDate: r.meetings.date,
          paidAmount,
          cancelDate: r.cancelled_at ? toKSTDate(new Date(r.cancelled_at)) : getKSTToday(),
        })
      : paidAmount
    return {
      id: r.id,
      cancelledAt: r.cancelled_at,
      refundAmount,
      paidAmount,
      meetingId: r.meetings?.id ?? null,
      meetingTitle: r.meetings?.title ?? null,
      meetingDate: r.meetings?.date ?? null,
      nickname: r.profiles?.nickname ?? '(알수없음)',
      realName: r.profiles?.real_name ?? null,
      phone: r.profiles?.phone ?? null,
    }
  })
}

// 탭 B 아래: 입금 전 취소 (읽기 전용 — 월말 통장 대조용, 2026-10-15 대표님 1안)
// 계좌이체 취소 + refunded_amount 0 + 결제 금액 > 0 = 운영자가 입금을 확인하기 전에 닫힌 건
// (판정 근거: refund.ts isCancelledBeforeDeposit). 회원이 몰래 입금했을 수 있어 통장과 맞춰 보는 용도다.
// 환불 처리 버튼은 두지 않는다 — 실제 입금이 확인되면 그때 운영진이 따로 처리한다.
// 실명·연락처는 싣지 않는다 (대표님 지정 항목: 취소 시각·모임·닉네임·참가비·돌려줄 금액)
export type CancelledBeforeDepositRow = {
  id: string
  cancelledAt: string | null
  /** 이 회원이 내기로 한 참가비 (스텝 할인 반영된 결제 금액) */
  paidAmount: number
  /** 입금했다면 돌려줄 금액 — 환불 대기 탭과 같은 함수(recommendedTransferRefund) */
  refundIfDeposited: number
  meetingId: string | null
  meetingTitle: string | null
  meetingDate: string | null
  /** 지워진 모임은 운영 상세가 열리지 않아 링크를 걸지 않는다 */
  meetingDeleted: boolean
  nickname: string
}

type CancelledBeforeDepositRegRow = {
  id: string
  cancelled_at: string | null
  cancel_type: string | null
  paid_amount: number | null
  profiles: { nickname: string | null } | null
  meetings: { id: string | null; title: string | null; date: string | null; meeting_type: string | null; status: string | null } | null
}

export async function getCancelledBeforeDeposit(supabase: SupabaseClient): Promise<CancelledBeforeDepositRow[]> {
  const { data, error } = await supabase
    .from('registrations')
    .select('id, cancelled_at, cancel_type, paid_amount, profiles(nickname), meetings(id, title, date, meeting_type, status)')
    .eq('status', 'cancelled')
    .eq('payment_method', 'transfer')
    .eq('refunded_amount', 0)
    .gt('paid_amount', 0)
    .order('cancelled_at', { ascending: false })

  if (error) throw error

  return ((data ?? []) as unknown as CancelledBeforeDepositRegRow[]).map((r) => {
    const paidAmount = r.paid_amount ?? 0
    const refundIfDeposited = r.meetings?.date
      ? recommendedTransferRefund({
          cancelType: r.cancel_type,
          meetingType: r.meetings.meeting_type,
          meetingDate: r.meetings.date,
          paidAmount,
          cancelDate: r.cancelled_at ? toKSTDate(new Date(r.cancelled_at)) : getKSTToday(),
        })
      : paidAmount
    return {
      id: r.id,
      cancelledAt: r.cancelled_at,
      paidAmount,
      refundIfDeposited,
      meetingId: r.meetings?.id ?? null,
      meetingTitle: r.meetings?.title ?? null,
      meetingDate: r.meetings?.date ?? null,
      meetingDeleted: r.meetings?.status === 'deleted' || r.meetings?.status === 'deleting',
      nickname: r.profiles?.nickname ?? '(알수없음)',
    }
  })
}
