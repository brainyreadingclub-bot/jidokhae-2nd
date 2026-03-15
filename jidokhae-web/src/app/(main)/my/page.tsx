import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getKSTToday } from '@/lib/kst'
import RegistrationCard from '@/components/registrations/RegistrationCard'
import type { RegistrationWithMeeting } from '@/types/registration'

export default async function MyPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: registrations, error } = await supabase
    .from('registrations')
    .select('*, meetings(*)')
    .eq('user_id', user.id)
    .in('status', ['confirmed', 'cancelled'])
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`신청 내역 조회 실패: ${error.message}`)
  }

  const typedRegs = (registrations ?? []) as RegistrationWithMeeting[]
  const kstToday = getKSTToday()

  if (typedRegs.length === 0) {
    return (
      <div className="px-5 pt-6">
        <h1 className="text-xl font-extrabold text-primary-900 tracking-tight">내 신청</h1>
        <p className="mt-4 text-sm text-primary-400">신청 내역이 없습니다</p>
      </div>
    )
  }

  // Group: upcoming (confirmed + future date, ascending) vs past (rest, descending)
  const upcoming = typedRegs
    .filter((r) => r.status === 'confirmed' && r.meetings.date >= kstToday)
    .sort((a, b) => a.meetings.date.localeCompare(b.meetings.date))

  const past = typedRegs
    .filter((r) => !(r.status === 'confirmed' && r.meetings.date >= kstToday))
    .sort((a, b) => b.meetings.date.localeCompare(a.meetings.date))

  function getBadge(reg: RegistrationWithMeeting): { label: string; color: 'success' | 'gray' } {
    if (reg.status === 'cancelled') return { label: '취소됨', color: 'gray' }
    if (reg.meetings.date < kstToday) return { label: '참여 완료', color: 'success' }
    return { label: '신청완료', color: 'success' }
  }

  return (
    <div className="px-5 pt-6">
      <h1 className="text-xl font-extrabold text-primary-900 tracking-tight">내 신청</h1>

      {upcoming.length > 0 && (
        <>
          <h2 className="mt-5 mb-3 text-xs font-bold text-primary-500 tracking-tight">다가오는 모임</h2>
          <div className="flex flex-col gap-3">
            {upcoming.map((reg) => (
              <RegistrationCard key={reg.id} registration={reg} badge={getBadge(reg)} />
            ))}
          </div>
        </>
      )}

      {past.length > 0 && (
        <>
          <h2 className="mt-6 mb-3 text-xs font-bold text-primary-400 tracking-tight">지난 내역</h2>
          <div className="flex flex-col gap-3">
            {past.map((reg) => (
              <RegistrationCard key={reg.id} registration={reg} badge={getBadge(reg)} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
