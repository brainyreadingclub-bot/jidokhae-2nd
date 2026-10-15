import Link from 'next/link'
import { redirect } from 'next/navigation'
import { formatKoreanDate, formatKoreanTime, formatPaidAmount } from '@/lib/kst'
import { getSiteSettings } from '@/lib/site-settings'
import { isNextUiEnabled } from '@/lib/next-ui'
import { loadRegistrationSummary } from '@/lib/registration-summary'
import BankInfoCard from '@/components/meetings/BankInfoCard'
import { showsDepositGuide } from '@/lib/transfer-rules'

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ paymentId?: string; type?: string }>
}

export default async function ConfirmPage({ params, searchParams }: Props) {
  const { id } = await params
  const { paymentId, type } = await searchParams
  const isWaitlisted = type === 'waitlisted'
  const isPendingTransfer = type === 'pending_transfer'

  // next_ui ON이면 토스 스킨 완료 화면으로. 결제·이체 흐름의 도착지를 바꾸지 않고
  // 여기서 한 번 갈아탄다 — 결제 코드를 건드리지 않기 위해서다.
  if (await isNextUiEnabled()) {
    const qs = new URLSearchParams()
    if (paymentId) qs.set('paymentId', paymentId)
    if (type) qs.set('type', type)
    const suffix = qs.toString()
    redirect(`/meet/${id}/done${suffix ? `?${suffix}` : ''}`)
  }

  const { meeting: typedMeeting, paidAmount } = await loadRegistrationSummary(id, {
    paymentId,
    isPendingTransfer,
  })

  // 0원 모임은 받을 돈이 없다 — `type=pending_transfer`로 와도 입금 안내를 띄우지 않는다 (2026-10-13).
  // SQL(migration-free-transfer-confirmed.sql) 전에는 0원도 pending_transfer로 들어오므로 화면이 먼저 막는다
  const showDeposit = showsDepositGuide(type, typedMeeting?.fee)

  // Fetch bank info for pending_transfer
  const settings = showDeposit ? await getSiteSettings() : null

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

        <h1 className="text-xl font-extrabold text-neutral-900 tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
          {isWaitlisted ? '대기 신청이 접수됐어요' : '신청됐어요'}
        </h1>
        <p className="mt-2 text-sm text-neutral-500">
          {showDeposit
            ? '자리는 잡혀 있어요. 아직 입금 전이라면 아래 계좌로 보내 주세요'
            : isWaitlisted
              ? '자리가 나면 자동으로 신청이 완료돼요'
              : '모임에서 만나요'}
        </p>
        {isWaitlisted && (
          <p className="mt-1 text-xs text-neutral-500">
            모임 전날까지 자리가 나지 않으면 결제 금액을 모두 환불해 드려요
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
          <h2 className="text-base font-bold text-neutral-900">
            {typedMeeting.title}
          </h2>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-neutral-600 text-xs w-10">날짜</span>
              <span className="text-neutral-800 font-medium">{formatKoreanDate(typedMeeting.date)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-neutral-600 text-xs w-10">시간</span>
              <span className="text-neutral-800 font-medium">{formatKoreanTime(typedMeeting.time)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-neutral-600 text-xs w-10">장소</span>
              <span className="text-neutral-800 font-medium">{typedMeeting.location}</span>
            </div>
            <div
              className="flex items-start gap-2 pt-2"
              style={{ borderTop: '1px solid var(--color-surface-300)' }}
            >
              <span className="text-neutral-600 text-xs w-10 mt-0.5">결제 금액</span>
              <div className="flex flex-col">
                <span className="font-bold text-neutral-900">
                  {formatPaidAmount(paidAmount ?? typedMeeting.fee, typedMeeting.fee)}
                </span>
                {paidAmount !== null && paidAmount < typedMeeting.fee && (
                  <span className="text-[11px] font-medium text-primary-600 mt-0.5">
                    스텝 할인 50%
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bank info for pending transfer */}
      {showDeposit && settings && (
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
