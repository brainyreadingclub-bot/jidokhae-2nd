import type { SupabaseClient } from '@supabase/supabase-js'
import { getDaysUntil, toKSTDate, getKSTToday } from '@/lib/kst'

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
  refundAmount: number
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

type RefundRegRow = {
  id: string
  cancelled_at: string | null
  paid_amount: number | null
  profiles: { nickname: string | null; real_name: string | null; phone: string | null } | null
  meetings: { id: string | null; title: string | null; date: string | null } | null
}

// 탭 B: 환불 대기 (계좌이체 취소 + 미환불 + 실입금)
export async function getPendingRefunds(supabase: SupabaseClient): Promise<RefundRow[]> {
  const { data, error } = await supabase
    .from('registrations')
    .select('id, cancelled_at, paid_amount, profiles(nickname, real_name, phone), meetings(id, title, date)')
    .eq('status', 'cancelled')
    .eq('payment_method', 'transfer')
    .is('refunded_amount', null)
    .gt('paid_amount', 0)
    .order('cancelled_at', { ascending: true })

  if (error) throw error

  // 환불액은 표시용으로 paid_amount(원금)를 노출한다.
  // 실제 환불 처리는 mark-refunded 라우트가 calculateRefund(meeting.date, paid_amount, cancelled_at)로
  // 서버에서 재계산해 기록한다. 이 탭에 뜨는 계좌이체 취소 건은 대부분 100%(모임 삭제 or 3일+ 전 취소)라
  // 원금 표시가 실무상 오해를 최소화한다.
  return ((data ?? []) as unknown as RefundRegRow[]).map((r) => ({
    id: r.id,
    cancelledAt: r.cancelled_at,
    refundAmount: r.paid_amount ?? 0,
    meetingId: r.meetings?.id ?? null,
    meetingTitle: r.meetings?.title ?? null,
    meetingDate: r.meetings?.date ?? null,
    nickname: r.profiles?.nickname ?? '(알수없음)',
    realName: r.profiles?.real_name ?? null,
    phone: r.profiles?.phone ?? null,
  }))
}
