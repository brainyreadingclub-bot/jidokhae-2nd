import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatKoreanDate, formatKoreanTime, formatFee } from '@/lib/kst'
import type { Meeting } from '@/types/meeting'

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ paymentKey?: string }>
}

export default async function ConfirmPage({ params, searchParams }: Props) {
  const { id } = await params
  const { paymentKey: paymentId } = await searchParams
  const supabase = await createClient()

  // Fetch meeting info
  const { data: meeting } = await supabase
    .from('meetings')
    .select('*')
    .eq('id', id)
    .single()

  const typedMeeting = meeting as Meeting | null

  // Fetch registration info if paymentId provided
  let paidAmount: number | null = null
  if (paymentId) {
    const { data: reg } = await supabase
      .from('registrations')
      .select('paid_amount')
      .eq('payment_id', paymentId)
      .eq('status', 'confirmed')
      .limit(1)

    if (reg && reg.length > 0) {
      paidAmount = reg[0].paid_amount
    }
  }

  return (
    <div className="px-4 pt-6">
      <div className="flex flex-col items-center text-center">
        {/* Success icon */}
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-success"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <h1 className="text-xl font-bold text-gray-900">신청이 완료되었습니다</h1>
        <p className="mt-2 text-sm text-gray-500">
          모임에 참여해 주셔서 감사합니다
        </p>
      </div>

      {/* Meeting summary */}
      {typedMeeting && (
        <div className="mt-8 rounded-[var(--radius-lg)] border border-gray-100 bg-gray-50 p-4">
          <h2 className="text-base font-bold text-gray-900">
            {typedMeeting.title}
          </h2>
          <div className="mt-3 space-y-2 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <span className="text-gray-400">날짜</span>
              <span>{formatKoreanDate(typedMeeting.date)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">시간</span>
              <span>{formatKoreanTime(typedMeeting.time)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">장소</span>
              <span>{typedMeeting.location}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">결제금액</span>
              <span className="font-semibold text-primary-600">
                {formatFee(paidAmount ?? typedMeeting.fee)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Action */}
      <div className="mt-8">
        <Link
          href="/"
          className="block w-full rounded-[var(--radius-md)] bg-primary-500 py-3.5 text-center text-sm font-semibold text-white transition-colors hover:bg-primary-600"
        >
          모임 일정으로
        </Link>
      </div>
    </div>
  )
}
