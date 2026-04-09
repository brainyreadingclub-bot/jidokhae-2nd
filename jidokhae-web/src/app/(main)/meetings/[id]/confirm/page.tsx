import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatKoreanDate, formatKoreanTime, formatFee } from '@/lib/kst'
import { getSiteSettings } from '@/lib/site-settings'
import BankInfoCard from '@/components/meetings/BankInfoCard'
import type { Meeting } from '@/types/meeting'

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ paymentKey?: string; type?: string }>
}

export default async function ConfirmPage({ params, searchParams }: Props) {
  const { id } = await params
  const { paymentKey: paymentId, type } = await searchParams
  const isWaitlisted = type === 'waitlisted'
  const isPendingTransfer = type === 'pending_transfer'
  const supabase = await createClient()

  // Fetch meeting info
  const { data: meeting } = await supabase
    .from('meetings')
    .select('*')
    .eq('id', id)
    .single()

  const typedMeeting = meeting as Meeting | null

  // Fetch bank info for pending_transfer
  const settings = isPendingTransfer ? await getSiteSettings() : null

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
    <div className="px-5 pt-8">
      <div className="flex flex-col items-center text-center">
        {/* Success icon */}
        <div
          className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary-50"
          style={{ border: '1px solid var(--color-primary-100)' }}
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-primary-600"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <h1 className="text-xl font-extrabold text-primary-900 tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
          {isWaitlisted ? '대기 신청이 완료되었습니다' : '신청이 완료되었습니다'}
        </h1>
        <p className="mt-2 text-sm text-primary-500/70">
          {isPendingTransfer
            ? '아래 계좌로 입금해주세요'
            : isWaitlisted
              ? '취소자 발생 시 자동으로 참여가 확정됩니다'
              : '모임에 참여해 주셔서 감사합니다'}
        </p>
        {isWaitlisted && (
          <p className="mt-1 text-xs text-primary-400">
            모임 전날까지 승격되지 않으면 자동 전액 환불됩니다
          </p>
        )}
      </div>

      {/* Meeting summary */}
      {typedMeeting && (
        <div
          className="mt-8 rounded-[var(--radius-lg)] p-4"
          style={{
            backgroundColor: 'var(--color-surface-100)',
            border: '1px solid var(--color-surface-300)',
          }}
        >
          <h2 className="text-base font-bold text-primary-900">
            {typedMeeting.title}
          </h2>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-primary-400 text-xs w-10">날짜</span>
              <span className="text-primary-700 font-medium">{formatKoreanDate(typedMeeting.date)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-primary-400 text-xs w-10">시간</span>
              <span className="text-primary-700 font-medium">{formatKoreanTime(typedMeeting.time)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-primary-400 text-xs w-10">장소</span>
              <span className="text-primary-700 font-medium">{typedMeeting.location}</span>
            </div>
            <div
              className="flex items-center gap-2 pt-2"
              style={{ borderTop: '1px solid var(--color-surface-300)' }}
            >
              <span className="text-primary-400 text-xs w-10">결제</span>
              <span className="font-bold text-accent-600">
                {formatFee(paidAmount ?? typedMeeting.fee)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Bank info for pending transfer */}
      {isPendingTransfer && settings && (
        <div className="mt-4 px-1">
          <BankInfoCard
            bankName={settings.bank_name ?? ''}
            bankAccount={settings.bank_account ?? ''}
            bankHolder={settings.bank_holder ?? ''}
          />
        </div>
      )}

      {/* Action */}
      <div className="mt-8">
        <Link
          href="/"
          className="block w-full rounded-[var(--radius-lg)] bg-primary-600 py-4 text-center text-sm font-bold text-white tracking-wide transition-all hover:bg-primary-700 active:scale-[0.98]"
          style={{ boxShadow: '0 4px 14px rgba(27, 67, 50, 0.25)' }}
        >
          모임 일정으로
        </Link>
      </div>
    </div>
  )
}
