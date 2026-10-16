'use client'

import Link from 'next/link'
// formatFee = 환불 금액(0은 "돌려받을 돈 없음")
// formatPaidAmountWithUnitForScreen = 결제 금액 — 「0원」은 **모임 참가비**로만 판정한다
import { formatKoreanDate, formatKoreanTime, formatFee, formatPaidAmountWithUnitForScreen } from '@/lib/kst'
import type { RegistrationWithMeeting } from '@/types/registration'
import { isCancelledBeforeDeposit } from '@/lib/refund'

type Props = {
  registration: RegistrationWithMeeting
  badge: { label: string; color: 'success' | 'gray' }
  /** 본인 `profiles.is_free` — 입금이 없는 참석자라 「입금하셨다면…」을 붙이지 않는다 */
  isFreeMember?: boolean
}

export default function RegistrationCard({ registration, badge, isFreeMember = false }: Props) {
  const meeting = registration.meetings
  const isDeleted =
    meeting.status === 'deleted' || meeting.status === 'deleting'
  const isCancelled = registration.status === 'cancelled' ||
    registration.status === 'waitlist_cancelled' ||
    registration.status === 'waitlist_refunded'

  const isMuted = isCancelled || isDeleted

  const cardInner = (
    <>
      <div className="p-[var(--spacing-card)]">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className={`text-body font-semibold truncate ${isMuted ? 'text-neutral-400 line-through decoration-neutral-400' : 'text-neutral-800'}`}>
              {meeting.title}
            </h3>
            <div className="mt-1.5 flex items-center gap-2 text-caption text-neutral-500">
              <span>{formatKoreanDate(meeting.date)}</span>
              <span className="text-neutral-300">·</span>
              <span>{formatKoreanTime(meeting.time)}</span>
            </div>
            <div className="mt-1 text-caption text-neutral-500">{meeting.location}</div>
            {/* 운영자가 모임을 지운 신청 — 회원 본인 취소와 구분해 알린다 (문구표준) */}
            {registration.status === 'cancelled' && registration.cancel_type === 'meeting_deleted' && (
              <div className="mt-1 text-caption font-semibold text-neutral-600">모임이 취소됐어요</div>
            )}
          </div>

          <span
            className={`ml-3 inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-tight ${
              badge.color === 'success'
                ? 'bg-primary-50 text-primary-700'
                : 'text-neutral-500'
            }`}
            style={
              badge.color === 'success'
                ? { border: '1px solid var(--color-primary-100)' }
                : { backgroundColor: 'var(--color-neutral-200)', border: '1px solid var(--color-neutral-300)' }
            }
          >
            {badge.label}
          </span>
        </div>

        {registration.paid_amount != null && (
          <div className="mt-3 pt-2.5 border-t border-neutral-200 text-caption text-neutral-600">
            결제 금액{' '}
            <span className={`font-bold font-mono ${isMuted ? 'line-through' : ''}`}>
              {/* 🔴 「0원」 판정은 **모임 참가비**로 한다. 결제액으로 판정하면
                  유료 모임인데 paid_amount가 0인 건(2026-10-06 중복환불 장부 정리)이
                  「0원」이 되어 "이 모임은 공짜였다"는 거짓말이 된다 */}
              {formatPaidAmountWithUnitForScreen(registration.paid_amount, meeting.fee)}
            </span>
            {isCancelled &&
              registration.refunded_amount != null &&
              registration.refunded_amount > 0 && (
                <span className="ml-2">
                  · 환불 완료 ·{' '}
                  <span className="font-semibold font-mono text-primary-600">
                    {formatFee(registration.refunded_amount)}원
                  </span>
                </span>
              )}
            {/* 계좌이체로 입금한 뒤 취소해 운영자가 손으로 돌려줄 건(refunded_amount NULL — 0은 「받은 돈 없음」이라 제외).
                종전에는 아무 표시가 없어 회원이 환불되는지 알 수 없었다 (2026-10-14 코드 조사 §1-3 6번) */}
            {registration.status === 'cancelled' &&
              registration.payment_method === 'transfer' &&
              registration.refunded_amount === null &&
              registration.paid_amount > 0 && (
                <span className="ml-2 font-semibold text-primary-600">· 환불 진행 중</span>
              )}
          </div>
        )}
        {/* 입금 확인 전에 취소된 계좌이체 — 혹시 입금했어도 돌려받는다는 걸 알린다. 0원 모임 취소(결제 금액 0)에는 붙이지 않는다 (2026-10-15 대표님 1안) */}
        {!isFreeMember && isCancelledBeforeDeposit(registration) && (
          <p className="mt-1.5 text-caption text-neutral-600 break-keep">입금하셨다면 운영진이 확인 후 돌려드려요</p>
        )}
      </div>
    </>
  )

  const cardStyle = {
    backgroundColor: isMuted ? 'var(--color-neutral-50)' : '#fff',
    boxShadow: isMuted ? 'none' : 'var(--shadow-sm)',
  }

  // Deleted/deleting meetings: non-clickable card with muted style
  if (isDeleted) {
    return (
      <div
        className="block rounded-[var(--radius-md)] border border-neutral-200 overflow-hidden opacity-60"
        style={cardStyle}
      >
        {cardInner}
      </div>
    )
  }

  return (
    <Link
      href={`/meetings/${meeting.id}`}
      className={`block rounded-[var(--radius-md)] border border-neutral-200 overflow-hidden transition-all duration-200 hover:-translate-y-0.5${isMuted ? ' opacity-60' : ''}`}
      style={cardStyle}
    >
      {cardInner}
    </Link>
  )
}
