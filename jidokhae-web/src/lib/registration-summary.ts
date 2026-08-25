import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth'
import type { Meeting } from '@/types/meeting'

/**
 * 신청 완료 화면이 쓰는 요약 — 모임 + 실제 결제 금액.
 * 구 스킨(`(main)/meetings/[id]/confirm`)과 새 스킨(`(next)/meet/[id]/done`)이 공유한다.
 *
 * 카드결제는 payment_id로, 계좌이체는 본인 pending_transfer 행으로 찾는다
 * (이체 흐름은 paymentId가 없어 정가로 폴백되던 표시 버그를 이렇게 고쳤다).
 */
export type RegistrationSummary = {
  meeting: Meeting | null
  paidAmount: number | null
}

export async function loadRegistrationSummary(
  meetingId: string,
  { paymentId, isPendingTransfer }: { paymentId?: string; isPendingTransfer: boolean },
): Promise<RegistrationSummary> {
  const supabase = await createClient()

  const { data: meeting } = await supabase
    .from('meetings')
    .select('*')
    .eq('id', meetingId)
    .single()

  let paidAmount: number | null = null
  if (paymentId) {
    const { data: reg } = await supabase
      .from('registrations')
      .select('paid_amount')
      .eq('payment_id', paymentId)
      .in('status', ['confirmed', 'waitlisted'])
      .limit(1)

    if (reg && reg.length > 0) {
      paidAmount = reg[0].paid_amount
    }
  } else if (isPendingTransfer) {
    const user = await getUser()
    if (user) {
      const { data: reg } = await supabase
        .from('registrations')
        .select('paid_amount')
        .eq('meeting_id', meetingId)
        .eq('user_id', user.id)
        .eq('status', 'pending_transfer')
        .order('created_at', { ascending: false })
        .limit(1)

      if (reg && reg.length > 0) {
        paidAmount = reg[0].paid_amount
      }
    }
  }

  return { meeting: (meeting as Meeting | null) ?? null, paidAmount }
}
