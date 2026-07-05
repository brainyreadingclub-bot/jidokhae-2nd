import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { getProfile } from '@/lib/profile'
import { createServiceClient } from '@/lib/supabase/admin'
import { getPendingDeposits, getPendingRefunds } from '@/lib/settlement'
import SettlementTabs from '@/components/admin/SettlementTabs'

export default async function AdminSettlementsPage() {
  const user = await getUser()
  if (!user) redirect('/auth/login')

  const profile = await getProfile(user.id)
  if (profile.role !== 'admin') redirect('/admin')

  const supabase = createServiceClient()

  const [deposits, refunds] = await Promise.all([
    getPendingDeposits(supabase),
    getPendingRefunds(supabase),
  ])

  return (
    <div className="px-5 pt-6 pb-10 lg:px-10 lg:pt-10">
      <div className="mb-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-500">
          정산
        </div>
        <h1
          className="mt-1 text-2xl font-extrabold tracking-tight text-primary-900 lg:text-3xl"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          입금 · 환불 관리
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          계좌이체 입금 확인과 환불 처리를 한 곳에서 관리합니다.
        </p>
      </div>
      <div className="mt-6">
        <SettlementTabs deposits={deposits} refunds={refunds} />
      </div>
    </div>
  )
}
