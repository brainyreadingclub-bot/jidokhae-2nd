import { notFound } from 'next/navigation'
import { loadRegistrationSummary } from '@/lib/registration-summary'
import { getProfile } from '@/lib/profile'
import { getUser } from '@/lib/auth'
import { getSiteSettings } from '@/lib/site-settings'
import RegistrationDoneView from '@/components/next/RegistrationDoneView'
import { showsDepositGuide } from '@/lib/transfer-rules'

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ paymentId?: string; type?: string }>
}

/** 신청 완료 (승인 시안 08). 화면은 RegistrationDoneView. */
export default async function NextRegistrationDonePage({ params, searchParams }: Props) {
  const { id } = await params
  const { paymentId, type } = await searchParams
  const isPendingTransfer = type === 'pending_transfer'

  const [{ meeting, paidAmount }, settings, user] = await Promise.all([
    loadRegistrationSummary(id, { paymentId, isPendingTransfer }),
    getSiteSettings(),
    getUser(),
  ])

  if (!meeting) notFound()

  const profile = user ? await getProfile(user.id) : null
  // 입금자명 "M/D 닉네임" — 상세와 같은 규칙 (은행 12자 한도 + 운영자 식별)
  const [, mm, dd] = meeting.date.split('-')
  const depositorName = profile ? `${Number(mm)}/${Number(dd)} ${profile.nickname ?? ''}` : ''

  return (
    <RegistrationDoneView
      data={{
        meetingId: id,
        title: meeting.title,
        date: meeting.date,
        time: meeting.time,
        location: meeting.location,
        region: meeting.region ?? null,
        amount: paidAmount ?? meeting.fee ?? null,
        meetingFee: meeting.fee,
        // 0원 모임은 받을 돈이 없다 — pending_transfer로 와도 「신청 완료」로 그린다 (2026-10-13).
        // SQL 전에는 0원도 pending_transfer로 들어오므로 화면이 먼저 막는다
        kind: showsDepositGuide(type, meeting.fee)
          ? 'pending_transfer'
          : type === 'waitlisted'
            ? 'waitlisted'
            : 'confirmed',
        bankName: settings.bank_name ?? '',
        bankAccount: settings.bank_account ?? '',
        bankHolder: settings.bank_holder ?? '',
        depositorName,
      }}
    />
  )
}
