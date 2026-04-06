import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { getMeeting } from '@/lib/meeting'
import { getProfile } from '@/lib/profile'
import { getSiteSettings } from '@/lib/site-settings'
import { formatFee } from '@/lib/kst'
import BankInfoCard from '@/components/meetings/BankInfoCard'
import TransferForm from '@/components/meetings/TransferForm'
import CopyableDepositorName from '@/components/meetings/CopyableDepositorName'

type Props = {
  params: Promise<{ id: string }>
}

export default async function TransferPage({ params }: Props) {
  const { id } = await params

  const user = await getUser()
  if (!user) redirect('/auth/login')

  const meeting = await getMeeting(id)
  if (!meeting) redirect('/')

  const [profile, settings] = await Promise.all([
    getProfile(user.id),
    getSiteSettings(),
  ])

  if (settings.payment_mode !== 'transfer_only') {
    redirect(`/meetings/${id}`)
  }

  const bankName = settings.bank_name ?? ''
  const bankAccount = settings.bank_account ?? ''
  const bankHolder = settings.bank_holder ?? ''
  const realName = profile.real_name ?? profile.nickname
  const depositorName = `${meeting.title} ${realName}`

  return (
    <div className="mx-auto max-w-screen-sm px-5 py-8">
      {/* Back link */}
      <Link
        href={`/meetings/${id}`}
        className="inline-flex items-center gap-1 text-sm text-primary-500 hover:text-primary-700 transition-colors"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
        뒤로가기
      </Link>

      {/* Meeting title + fee */}
      <div className="mt-6">
        <h1
          className="text-xl font-extrabold text-primary-900 leading-snug tracking-tight"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {meeting.title}
        </h1>
        <p className="mt-2 text-lg font-bold text-accent-600">
          참가비: {formatFee(meeting.fee)}원
        </p>
      </div>

      {/* Bank info card */}
      <div className="mt-6">
        <BankInfoCard
          bankName={bankName}
          bankAccount={bankAccount}
          bankHolder={bankHolder}
        />
      </div>

      {/* Depositor name guidance */}
      <CopyableDepositorName depositorName={depositorName} />

      {/* Transfer form (submit button) */}
      <div className="mt-8">
        <TransferForm meetingId={id} meetingFee={meeting.fee} />
      </div>
    </div>
  )
}
