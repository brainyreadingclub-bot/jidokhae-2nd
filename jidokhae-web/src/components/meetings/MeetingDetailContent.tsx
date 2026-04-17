import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth'
import { getProfile } from '@/lib/profile'
import { getMeeting } from '@/lib/meeting'
import { getKSTToday, getButtonState } from '@/lib/kst'
import { getSiteSettings, DEFAULT_PAYMENT_MODE } from '@/lib/site-settings'
import Link from 'next/link'
import MeetingDetailInfo from '@/components/meetings/MeetingDetailInfo'
import MeetingActionButton from '@/components/meetings/MeetingActionButton'
import BankInfoCard from '@/components/meetings/BankInfoCard'
import TrackMeetingView from '@/components/analytics/TrackMeetingView'

export default async function MeetingDetailContent({ id }: { id: string }) {
  const supabase = await createClient()
  const user = await getUser()

  if (!user) redirect('/auth/login')

  const typedMeeting = await getMeeting(id)

  if (!typedMeeting || typedMeeting.status === 'deleted') {
    notFound()
  }

  const [countsResult, myRegResult, myWaitlistResult, pendingResult, settings] = await Promise.all([
    supabase.rpc('get_confirmed_counts', { meeting_ids: [id] }),
    supabase
      .from('registrations')
      .select('id, paid_amount, payment_id, payment_method')
      .eq('user_id', user.id)
      .eq('meeting_id', id)
      .eq('status', 'confirmed')
      .limit(1),
    supabase
      .from('registrations')
      .select('id, paid_amount, payment_method')
      .eq('user_id', user.id)
      .eq('meeting_id', id)
      .eq('status', 'waitlisted')
      .limit(1),
    supabase
      .from('registrations')
      .select('id, paid_amount')
      .eq('user_id', user.id)
      .eq('meeting_id', id)
      .eq('status', 'pending_transfer')
      .limit(1),
    getSiteSettings(),
  ])

  if (countsResult.error) {
    throw new Error(`참가자 수 조회 실패: ${countsResult.error.message}`)
  }
  if (myRegResult.error) {
    throw new Error(`내 신청 조회 실패: ${myRegResult.error.message}`)
  }
  if (myWaitlistResult.error) {
    throw new Error(`대기 신청 조회 실패: ${myWaitlistResult.error.message}`)
  }

  const profile = await getProfile(user.id)

  const confirmedCount = Number(
    (countsResult.data as { meeting_id: string; confirmed_count: number }[] | null)
      ?.find((c) => c.meeting_id === id)?.confirmed_count ?? 0,
  )
  const myReg = myRegResult.data?.[0] ?? null
  const myWaitlistReg = myWaitlistResult.data?.[0] ?? null
  const myPendingTransfer = pendingResult.data?.[0] ?? null
  const hasConfirmed = myReg !== null
  const hasWaitlisted = myWaitlistReg !== null
  const hasPendingTransfer = myPendingTransfer !== null
  const paymentMode = settings.payment_mode ?? DEFAULT_PAYMENT_MODE
  const isFull = confirmedCount >= typedMeeting.capacity
  const role = profile.role ?? 'member'
  const isAdmin = role === 'admin'
  const isEditorOrAdmin = role === 'admin' || role === 'editor'

  if (typedMeeting.status === 'deleting' && !isAdmin) {
    notFound()
  }

  const kstToday = getKSTToday()
  const buttonState = getButtonState(
    typedMeeting.date,
    kstToday,
    hasConfirmed,
    isFull,
    hasWaitlisted,
    hasPendingTransfer,
  )

  const hasStickyButton =
    buttonState.type === 'register' ||
    buttonState.type === 'full' ||
    buttonState.type === 'cancel' ||
    buttonState.type === 'join_waitlist' ||
    buttonState.type === 'waitlist_cancel' ||
    buttonState.type === 'pending_transfer'

  return (
    <div style={{ paddingBottom: hasStickyButton ? 'calc(9rem + env(safe-area-inset-bottom, 0px))' : '1.5rem' }}>
      <TrackMeetingView
        meetingId={typedMeeting.id}
        title={typedMeeting.title}
        fee={typedMeeting.fee}
      />
      <MeetingDetailInfo
        meeting={typedMeeting}
        confirmedCount={confirmedCount}
        capacity={typedMeeting.capacity}
      />

      {hasPendingTransfer && (
        <div className="mx-5 mt-4 space-y-3">
          <div className="bg-accent-50 border border-accent-200 rounded-xl p-4 text-center">
            <p className="text-sm font-medium text-accent-700">입금 확인 대기 중입니다</p>
            <p className="text-xs text-accent-600 mt-1">아직 입금 전이라면 아래 계좌로 입금해주세요</p>
          </div>
          <BankInfoCard
            bankName={settings.bank_name ?? ''}
            bankAccount={settings.bank_account ?? ''}
            bankHolder={settings.bank_holder ?? ''}
          />
        </div>
      )}

      <MeetingActionButton
        buttonState={buttonState}
        meetingId={typedMeeting.id}
        meetingTitle={typedMeeting.title}
        meetingFee={typedMeeting.fee}
        meetingDate={typedMeeting.date}
        userId={user.id}
        registrationId={myReg?.id}
        paidAmount={myReg?.paid_amount}
        waitlistRegistrationId={myWaitlistReg?.id}
        waitlistPaidAmount={myWaitlistReg?.paid_amount}
        pendingTransferRegistrationId={myPendingTransfer?.id}
        paymentMode={paymentMode}
        registrationPaymentMethod={myReg?.payment_method}
        supportContact={settings.support_contact ?? ''}
        waitlistPaymentMethod={myWaitlistReg?.payment_method}
        bankName={settings.bank_name ?? ''}
        bankAccount={settings.bank_account ?? ''}
        bankHolder={settings.bank_holder ?? ''}
        depositorName={`${typedMeeting.title} ${profile.nickname}`}
      />

      {isEditorOrAdmin && (
        <div
          className="mx-5 mt-8 rounded-[var(--radius-md)] p-4"
          style={{ backgroundColor: 'var(--color-surface-100)', border: '1px solid var(--color-surface-300)' }}
        >
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-500">
            운영자 전용
          </div>
          <Link
            href={`/admin/meetings/${typedMeeting.id}`}
            className="flex items-center justify-between gap-3"
          >
            <div>
              <div className="text-sm font-bold text-primary-800">
                관리자 페이지에서 보기
              </div>
              <div className="mt-0.5 text-xs text-primary-500">
                신청자 목록 · 입금 확인 · 재정 요약
              </div>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary-400">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>
        </div>
      )}
    </div>
  )
}
