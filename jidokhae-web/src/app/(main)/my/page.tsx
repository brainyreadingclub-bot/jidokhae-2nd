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

  return (
    <div className="px-5 pt-6">
      <h1 className="text-xl font-extrabold text-primary-900 tracking-tight">내 신청</h1>
      <div className="mt-4 flex flex-col gap-3">
        {typedRegs.map((reg) => {
          let badge: { label: string; color: 'success' | 'gray' }
          if (reg.status === 'cancelled') {
            badge = { label: '취소됨', color: 'gray' }
          } else if (reg.meetings.date < kstToday) {
            badge = { label: '참여 완료', color: 'success' }
          } else {
            badge = { label: '신청완료', color: 'success' }
          }

          return (
            <RegistrationCard
              key={reg.id}
              registration={reg}
              badge={badge}
            />
          )
        })}
      </div>
    </div>
  )
}
