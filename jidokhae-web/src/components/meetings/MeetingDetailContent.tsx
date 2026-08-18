import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth'
import { getProfile } from '@/lib/profile'
import { getMeeting } from '@/lib/meeting'
import { getKSTToday, getButtonState } from '@/lib/kst'
import { getSiteSettings, DEFAULT_PAYMENT_MODE } from '@/lib/site-settings'
import { getDisplayFee } from '@/lib/staff-slot'
import Link from 'next/link'
import MeetingDetailInfo from '@/components/meetings/MeetingDetailInfo'
import MeetingActionButton from '@/components/meetings/MeetingActionButton'
import BankInfoCard from '@/components/meetings/BankInfoCard'
import RegistrationStatusBadge from '@/components/meetings/RegistrationStatusBadge'
import RegistrationHero from '@/components/meetings/RegistrationHero'
import ParticipantsList from '@/components/meetings/ParticipantsList'
import BookSection from '@/components/meetings/BookSection'
import TrackMeetingView from '@/components/analytics/TrackMeetingView'

export default async function MeetingDetailContent({ id }: { id: string }) {
  const supabase = await createClient()
  const user = await getUser()

  if (!user) redirect('/auth/login')

  const typedMeeting = await getMeeting(id)

  if (!typedMeeting || typedMeeting.status === 'deleted') {
    notFound()
  }

  // 토론모임 + 책 연결 시 표지·선정 이유·책 소개 (2026-08-18 표지 배치)
  const { data: bookRow } =
    typedMeeting.meeting_type === 'discussion' && typedMeeting.book_id
      ? await supabase
          .from('books')
          .select('title, authors, publisher, thumbnail, description')
          .eq('id', typedMeeting.book_id)
          .maybeSingle()
      : { data: null }

  const [countsResult, myRegResult, myWaitlistResult, pendingResult, participantsResult, settings] = await Promise.all([
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
    supabase.rpc('get_meeting_participant_nicknames', { p_meeting_id: id }),
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
  // participantsResult.error는 명단이 부가 기능이라 throw 대신 무시 (빈 배열로 폴백)

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

  const participantNicknames = (participantsResult.data as { nickname: string }[] | null)
    ?.map((row) => row.nickname)
    .filter((n): n is string => typeof n === 'string' && n.length > 0) ?? []

  // confirmed/pending_transfer 모두 hero가 흡수 (운영자 입금 확인 지연을 회원이 체감하지 않게)
  // 작은 상단 뱃지는 waitlisted만
  const registrationStatus: 'waitlisted' | null = hasWaitlisted ? 'waitlisted' : null

  // 회원 입장에서 입금 후 운영자 확인 전이라도 "신청 완료"처럼 보이게 — 명단/카운트 모두 confirmed와 동등 취급
  const isBookedSelf = hasConfirmed || hasPendingTransfer

  // 카운트 마스킹 해제 조건: 운영자 또는 본인이 정원에 차지한 경우 (confirmed/pending_transfer)
  const showAccurateCount = isEditorOrAdmin || isBookedSelf

  // 입금자명: "M/D 닉네임" — 은행 입금자명 글자수(한글 12자) 한도 + 운영자 식별 편의
  const [, mm, dd] = typedMeeting.date.split('-')
  const depositorName = `${Number(mm)}/${Number(dd)} ${profile.nickname}`

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

  // displayFee — 자격자(admin/editor/staff) + 슬롯 여석 시 할인가, 그 외 정가
  const { fee: displayFee, isDiscounted } = await getDisplayFee(
    typedMeeting.id,
    { role: profile.role, is_staff: profile.is_staff },
    typedMeeting.fee,
    typedMeeting.meeting_type,
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
      {isBookedSelf && (
        <RegistrationHero
          nickname={profile.nickname || ''}
          meetingDate={typedMeeting.date}
          meetingTime={typedMeeting.time}
          kstToday={kstToday}
          isPending={hasPendingTransfer}
        />
      )}
      <RegistrationStatusBadge status={registrationStatus} />
      {bookRow && (
        <BookSection book={bookRow} selectionReason={typedMeeting.selection_reason} />
      )}
      <MeetingDetailInfo
        meeting={typedMeeting}
        confirmedCount={confirmedCount}
        capacity={typedMeeting.capacity}
        isPrivileged={showAccurateCount}
        displayFee={displayFee}
        isStaffDiscount={isDiscounted}
      />

      {hasPendingTransfer && (
        <div className="mt-4 space-y-3">
          <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 text-center">
            <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-neutral-800">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent-500" aria-hidden="true" />
              입금 확인 대기 중입니다
            </p>
            <p className="text-xs text-neutral-600 mt-1">아직 입금 전이라면 아래 계좌로 입금해주세요</p>
          </div>
          <BankInfoCard
            bankName={settings.bank_name ?? ''}
            bankAccount={settings.bank_account ?? ''}
            bankHolder={settings.bank_holder ?? ''}
          />
        </div>
      )}

      {(isBookedSelf || isEditorOrAdmin) && (
        <ParticipantsList nicknames={participantNicknames} />
      )}

      <MeetingActionButton
        buttonState={buttonState}
        meetingId={typedMeeting.id}
        meetingTitle={typedMeeting.title}
        meetingFee={typedMeeting.fee}
        displayFee={displayFee}
        isStaffDiscount={isDiscounted}
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
        depositorName={depositorName}
      />

      {isEditorOrAdmin && (
        <div
          className="mt-8 rounded-[var(--radius-md)] p-4"
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
              <div className="mt-0.5 text-xs text-neutral-500">
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
