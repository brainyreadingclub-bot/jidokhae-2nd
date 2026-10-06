import Link from 'next/link'
import { loadMeetingDetail, hasStickyAction } from '@/lib/meeting-detail'
import MeetingDetailInfo from '@/components/meetings/MeetingDetailInfo'
import MeetingActionButton from '@/components/meetings/MeetingActionButton'
import BankInfoCard from '@/components/meetings/BankInfoCard'
import RegistrationStatusBadge from '@/components/meetings/RegistrationStatusBadge'
import RegistrationHero from '@/components/meetings/RegistrationHero'
import ParticipantsList from '@/components/meetings/ParticipantsList'
import BookSection from '@/components/meetings/BookSection'
import TrackMeetingView from '@/components/analytics/TrackMeetingView'

/**
 * 구 스킨(잉크그린) 모임 상세.
 * 조회·판정은 `lib/meeting-detail.ts`가 단일 소스 — `(next)` 토스 스킨과 공유한다.
 */
export default async function MeetingDetailContent({ id }: { id: string }) {
  const d = await loadMeetingDetail(id)
  const meeting = d.meeting

  // confirmed/pending_transfer 모두 hero가 흡수 (운영자 입금 확인 지연을 회원이 체감하지 않게)
  // 작은 상단 뱃지는 waitlisted만
  const registrationStatus: 'waitlisted' | null = d.hasWaitlisted ? 'waitlisted' : null

  const hasStickyButton = hasStickyAction(d.buttonState)

  return (
    <div style={{ paddingBottom: hasStickyButton ? 'calc(9rem + env(safe-area-inset-bottom, 0px))' : '1.5rem' }}>
      <TrackMeetingView
        meetingId={meeting.id}
        title={meeting.title}
        fee={meeting.fee}
      />
      {d.isBookedSelf && (
        <RegistrationHero
          nickname={d.nickname}
          meetingDate={meeting.date}
          meetingTime={meeting.time}
          kstToday={d.kstToday}
          isPending={d.hasPendingTransfer}
        />
      )}
      <RegistrationStatusBadge status={registrationStatus} />
      {d.book && (
        <BookSection book={d.book} selectionReason={meeting.selection_reason} />
      )}
      <MeetingDetailInfo
        meeting={meeting}
        confirmedCount={d.confirmedCount}
        capacity={meeting.capacity}
        isPrivileged={d.showAccurateCount}
        displayFee={d.displayFee}
        isStaffDiscount={d.isStaffDiscount}
      />

      {d.hasPendingTransfer && (
        <div className="mt-4 space-y-3">
          <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 text-center">
            <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-neutral-800">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent-500" aria-hidden="true" />
              입금 확인 대기 중입니다
            </p>
            <p className="text-xs text-neutral-600 mt-1">아직 입금 전이라면 아래 계좌로 입금해주세요</p>
          </div>
          <BankInfoCard
            bankName={d.bankName}
            bankAccount={d.bankAccount}
            bankHolder={d.bankHolder}
          />
        </div>
      )}

      {(d.isBookedSelf || d.isEditorOrAdmin) && (
        <ParticipantsList nicknames={d.participantNicknames} />
      )}

      <MeetingActionButton
        buttonState={d.buttonState}
        meetingId={meeting.id}
        meetingTitle={meeting.title}
        meetingFee={meeting.fee}
        displayFee={d.displayFee}
        isStaffDiscount={d.isStaffDiscount}
        meetingDate={meeting.date}
        meetingType={meeting.meeting_type ?? null}
        userId={d.userId}
        registrationId={d.myRegistrationId}
        paidAmount={d.myPaidAmount}
        waitlistRegistrationId={d.waitlistRegistrationId}
        waitlistPaidAmount={d.waitlistPaidAmount}
        pendingTransferRegistrationId={d.pendingTransferRegistrationId}
        paymentMode={d.paymentMode}
        registrationPaymentMethod={d.myPaymentMethod}
        supportContact={d.supportContact}
        waitlistPaymentMethod={d.waitlistPaymentMethod}
        bankName={d.bankName}
        bankAccount={d.bankAccount}
        bankHolder={d.bankHolder}
        depositorName={d.depositorName}
      />

      {d.isEditorOrAdmin && (
        <div
          className="mt-8 rounded-[var(--radius-md)] p-4"
          style={{ backgroundColor: 'var(--color-surface-100)', border: '1px solid var(--color-surface-300)' }}
        >
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-500">
            운영자 전용
          </div>
          <Link
            href={`/admin/meetings/${meeting.id}`}
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
