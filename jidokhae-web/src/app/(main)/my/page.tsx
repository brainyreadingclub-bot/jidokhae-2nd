import Link from 'next/link'
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
    .in('status', ['confirmed', 'cancelled', 'waitlisted', 'waitlist_cancelled', 'waitlist_refunded'])
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`신청 내역 조회 실패: ${error.message}`)
  }

  const typedRegs = (registrations ?? []) as RegistrationWithMeeting[]
  const kstToday = getKSTToday()

  if (typedRegs.length === 0) {
    return (
      <div className="px-5 pt-6">
        <h1 className="text-xl font-extrabold text-neutral-800 tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>내 신청</h1>
        <p className="mt-4 text-caption text-neutral-400">신청 내역이 없습니다</p>
        <Link
          href="/"
          className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors"
        >
          모임 둘러보기
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>
      </div>
    )
  }

  // Group: upcoming (confirmed/waitlisted + future date, ascending) vs past (rest, descending)
  const isUpcoming = (r: RegistrationWithMeeting) =>
    (r.status === 'confirmed' || r.status === 'waitlisted') && r.meetings.date >= kstToday

  const upcoming = typedRegs
    .filter(isUpcoming)
    .sort((a, b) => a.meetings.date.localeCompare(b.meetings.date))

  const past = typedRegs
    .filter((r) => !isUpcoming(r))
    .sort((a, b) => b.meetings.date.localeCompare(a.meetings.date))

  function getBadge(reg: RegistrationWithMeeting): { label: string; color: 'success' | 'gray' | 'accent' } {
    if (reg.status === 'cancelled') return { label: '취소됨', color: 'gray' }
    if (reg.status === 'waitlisted') return { label: '대기 중', color: 'accent' }
    if (reg.status === 'waitlist_cancelled') return { label: '대기 취소', color: 'gray' }
    if (reg.status === 'waitlist_refunded') return { label: '대기 환불', color: 'gray' }
    if (reg.meetings.date < kstToday) return { label: '참여 완료', color: 'success' }
    return { label: '신청완료', color: 'success' }
  }

  return (
    <div className="px-5 pt-6">
      <h1 className="text-xl font-extrabold text-neutral-800 tracking-tight">내 신청</h1>

      <h2 className="mt-5 mb-3 text-xs font-bold text-primary-500 tracking-tight">다가오는 모임</h2>
      {upcoming.length > 0 ? (
        <div className="flex flex-col gap-3">
          {upcoming.map((reg) => (
            <RegistrationCard key={reg.id} registration={reg} badge={getBadge(reg)} />
          ))}
        </div>
      ) : (
        <div className="rounded-[var(--radius-md)] bg-surface-50 border border-dashed border-neutral-300 py-8 text-center">
          <p className="text-caption text-neutral-400">신청한 모임이 없어요</p>
          <Link
            href="/"
            className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors"
          >
            모임 둘러보기
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>
        </div>
      )}

      {past.length > 0 && (
        <>
          <h2 className="mt-6 mb-3 text-xs font-bold text-neutral-400 tracking-tight">지난 내역</h2>
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
