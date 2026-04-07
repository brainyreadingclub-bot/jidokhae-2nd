import type { SupabaseClient } from '@supabase/supabase-js'
import { getMonthRange } from '@/lib/kst'

export type MonthlyRevenue = {
  totalPaid: number
  totalRefunded: number
  netRevenue: number
  prevNetRevenue: number
}

export async function getMonthlyRevenue(
  supabase: SupabaseClient,
  currentMonth: string,
  prevMonth: string,
): Promise<MonthlyRevenue> {
  const cur = getMonthRange(currentMonth)
  const prev = getMonthRange(prevMonth)

  const [curResult, prevResult] = await Promise.all([
    supabase
      .from('registrations')
      .select('paid_amount, refunded_amount, status, meetings!inner(date)')
      .gte('meetings.date', cur.start)
      .lt('meetings.date', cur.end),
    supabase
      .from('registrations')
      .select('paid_amount, refunded_amount, status, meetings!inner(date)')
      .gte('meetings.date', prev.start)
      .lt('meetings.date', prev.end),
  ])

  function aggregate(data: { paid_amount: number | null; refunded_amount: number | null; status: string }[]) {
    let totalPaid = 0
    let totalRefunded = 0
    for (const r of data) {
      if (r.paid_amount) totalPaid += r.paid_amount
      if (r.refunded_amount && r.refunded_amount > 0) totalRefunded += r.refunded_amount
    }
    return { totalPaid, totalRefunded, netRevenue: totalPaid - totalRefunded }
  }

  const curAgg = aggregate((curResult.data ?? []) as { paid_amount: number | null; refunded_amount: number | null; status: string }[])
  const prevAgg = aggregate((prevResult.data ?? []) as { paid_amount: number | null; refunded_amount: number | null; status: string }[])

  return {
    ...curAgg,
    prevNetRevenue: prevAgg.netRevenue,
  }
}

export type UpcomingMeetings = {
  count: number
  avgFillRate: number
  lowFillAlerts: { id: string; title: string; confirmed: number; capacity: number }[]
}

export async function getUpcomingMeetings(
  supabase: SupabaseClient,
  kstToday: string,
  weekLater: string,
): Promise<UpcomingMeetings> {
  const { data: meetings } = await supabase
    .from('meetings')
    .select('id, title, capacity')
    .eq('status', 'active')
    .gte('date', kstToday)
    .lte('date', weekLater)

  const typed = (meetings ?? []) as { id: string; title: string; capacity: number }[]
  if (typed.length === 0) return { count: 0, avgFillRate: 0, lowFillAlerts: [] }

  const ids = typed.map((m) => m.id)
  const { data: counts } = await supabase.rpc('get_confirmed_counts', { meeting_ids: ids })
  const countMap = new Map<string, number>(
    ((counts ?? []) as { meeting_id: string; confirmed_count: number }[])
      .map((c) => [c.meeting_id, Number(c.confirmed_count)]),
  )

  let totalRate = 0
  const lowFillAlerts: UpcomingMeetings['lowFillAlerts'] = []

  for (const m of typed) {
    const confirmed = countMap.get(m.id) ?? 0
    const rate = m.capacity > 0 ? confirmed / m.capacity : 0
    totalRate += rate
    if (rate < 0.5) {
      lowFillAlerts.push({ id: m.id, title: m.title, confirmed, capacity: m.capacity })
    }
  }

  return {
    count: typed.length,
    avgFillRate: Math.round((totalRate / typed.length) * 100),
    lowFillAlerts,
  }
}

export type MemberStats = {
  total: number
  profileCompleted: number
  phoneRegistered: number
  newThisMonth: number
}

export async function getMemberStats(
  supabase: SupabaseClient,
  monthStart: string,
): Promise<MemberStats> {
  const { data: profiles } = await supabase
    .from('profiles')
    .select('profile_completed_at, phone, created_at')

  const all = (profiles ?? []) as { profile_completed_at: string | null; phone: string | null; created_at: string }[]

  return {
    total: all.length,
    profileCompleted: all.filter((p) => p.profile_completed_at).length,
    phoneRegistered: all.filter((p) => p.phone).length,
    newThisMonth: all.filter((p) => p.created_at >= monthStart).length,
  }
}

export type Alerts = {
  deletingCount: number
  deletingMeetings: { id: string; title: string }[]
  unsettledVenues: { name: string }[]
}

export async function getAlerts(
  supabase: SupabaseClient,
  currentMonth: string,
): Promise<Alerts> {
  const range = getMonthRange(currentMonth)

  const [deletingResult, venueResult, settlementResult, meetingsResult] = await Promise.all([
    supabase.from('meetings').select('id, title').eq('status', 'deleting'),
    supabase.from('venues').select('id, name').eq('status', 'active'),
    supabase.from('venue_settlements').select('venue_id').eq('month', currentMonth).not('settled_at', 'is', null),
    supabase.from('meetings').select('venue_id').eq('status', 'active').gte('date', range.start).lt('date', range.end).not('venue_id', 'is', null),
  ])

  const deletingMeetings = (deletingResult.data ?? []) as { id: string; title: string }[]
  const venues = (venueResult.data ?? []) as { id: string; name: string }[]
  const settledIds = new Set(((settlementResult.data ?? []) as { venue_id: string }[]).map((s) => s.venue_id))
  const venuesWithMeetings = new Set(((meetingsResult.data ?? []) as { venue_id: string }[]).map((m) => m.venue_id))

  const unsettledVenues = venues
    .filter((v) => venuesWithMeetings.has(v.id) && !settledIds.has(v.id))
    .map((v) => ({ name: v.name }))

  return {
    deletingCount: deletingMeetings.length,
    deletingMeetings,
    unsettledVenues,
  }
}

export type VenueSettlementRow = {
  venueId: string
  venueName: string
  meetingCount: number
  totalPaid: number
  settlementType: string
  settlementRate: number
  settlementFixed: number
  settlementAmount: number
  settledAt: string | null
}

export async function getVenueSettlementData(
  supabase: SupabaseClient,
  currentMonth: string,
): Promise<VenueSettlementRow[]> {
  const range = getMonthRange(currentMonth)

  const [venuesResult, meetingsResult, settlementsResult] = await Promise.all([
    supabase.from('venues').select('*').eq('status', 'active'),
    supabase.from('meetings').select('id, venue_id').eq('status', 'active').gte('date', range.start).lt('date', range.end).not('venue_id', 'is', null),
    supabase.from('venue_settlements').select('*').eq('month', currentMonth),
  ])

  const venues = (venuesResult.data ?? []) as { id: string; name: string; settlement_type: string; settlement_rate: number; settlement_fixed: number }[]
  const meetings = (meetingsResult.data ?? []) as { id: string; venue_id: string }[]
  const settlements = (settlementsResult.data ?? []) as { venue_id: string; settled_at: string | null }[]

  // Group meetings by venue
  const meetingsByVenue = new Map<string, string[]>()
  for (const m of meetings) {
    const arr = meetingsByVenue.get(m.venue_id) ?? []
    arr.push(m.id)
    meetingsByVenue.set(m.venue_id, arr)
  }

  // Get confirmed registrations for all meetings this month
  const allMeetingIds = meetings.map((m) => m.id)
  let regData: { meeting_id: string; paid_amount: number | null }[] = []
  if (allMeetingIds.length > 0) {
    const { data } = await supabase
      .from('registrations')
      .select('meeting_id, paid_amount')
      .eq('status', 'confirmed')
      .in('meeting_id', allMeetingIds)
    regData = (data ?? []) as { meeting_id: string; paid_amount: number | null }[]
  }

  // Sum paid by meeting
  const paidByMeeting = new Map<string, number>()
  for (const r of regData) {
    paidByMeeting.set(r.meeting_id, (paidByMeeting.get(r.meeting_id) ?? 0) + (r.paid_amount ?? 0))
  }

  const settlementMap = new Map(settlements.map((s) => [s.venue_id, s.settled_at]))

  return venues
    .filter((v) => meetingsByVenue.has(v.id))
    .map((v) => {
      const venueMeetings = meetingsByVenue.get(v.id) ?? []
      const totalPaid = venueMeetings.reduce((sum, mid) => sum + (paidByMeeting.get(mid) ?? 0), 0)

      let settlementAmount = 0
      if (v.settlement_type === 'percentage') {
        settlementAmount = Math.floor(totalPaid * v.settlement_rate / 100)
      } else if (v.settlement_type === 'fixed') {
        settlementAmount = venueMeetings.length * v.settlement_fixed
      }

      return {
        venueId: v.id,
        venueName: v.name,
        meetingCount: venueMeetings.length,
        totalPaid,
        settlementType: v.settlement_type,
        settlementRate: v.settlement_rate,
        settlementFixed: v.settlement_fixed,
        settlementAmount,
        settledAt: settlementMap.get(v.id) ?? null,
      }
    })
}

/** 계좌이체 관련 알림 집계 */
export async function getTransferAlerts(supabase: SupabaseClient) {
  const [pendingResult, refundResult] = await Promise.all([
    supabase
      .from('registrations')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending_transfer'),
    supabase
      .from('registrations')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'cancelled')
      .eq('payment_method', 'transfer')
      .is('refunded_amount', null)
      .gt('paid_amount', 0),
  ])

  return {
    pendingTransferCount: pendingResult.count ?? 0,
    pendingRefundCount: refundResult.count ?? 0,
  }
}
