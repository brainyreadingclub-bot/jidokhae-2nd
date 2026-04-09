import Link from 'next/link'
import DeleteMeetingButton from './DeleteMeetingButton'
import AttendanceToggle from './AttendanceToggle'
import DepositToggle from '@/components/admin/DepositToggle'
import { getKSTToday, formatFee, toKSTDate } from '@/lib/kst'
import { calculateRefund } from '@/lib/refund'
import type { RegistrationWithProfile } from '@/types/registration'

type Props = {
  meetingId: string
  meetingStatus: string
  confirmedCount: number
  registrations: RegistrationWithProfile[]
  role: string
  meetingDate: string
}

const CANCEL_TYPE_LABELS: Record<string, string> = {
  user_cancelled: '회원 취소',
  meeting_deleted: '모임 삭제',
  waitlist_user_cancelled: '대기 취소',
  waitlist_auto_refunded: '자동 환불',
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  const month = d.getMonth() + 1
  const day = d.getDate()
  return `${month}/${day}`
}

export default function AdminMeetingSection({
  meetingId,
  meetingStatus,
  confirmedCount,
  registrations,
  role,
  meetingDate,
}: Props) {
  const showAttendance = meetingDate <= getKSTToday()

  const confirmedRegs = registrations.filter((r) => r.status === 'confirmed' || r.status === 'cancelled' || r.status === 'pending_transfer')
  const waitlistedRegs = registrations
    .filter((r) => r.status === 'waitlisted' || r.status === 'waitlist_cancelled' || r.status === 'waitlist_refunded')
    .sort((a, b) => a.created_at.localeCompare(b.created_at))

  // 요약 통계 계산
  const totalPaid = confirmedRegs
    .reduce((sum, r) => sum + (r.paid_amount ?? 0), 0)
  const totalRefunded = confirmedRegs
    .filter((r) => r.status === 'cancelled' && r.refunded_amount)
    .reduce((sum, r) => sum + (r.refunded_amount ?? 0), 0)
  const netRevenue = totalPaid - totalRefunded
  const attendedCount = confirmedRegs.filter((r) => r.status === 'confirmed' && r.attended).length

  function getStatusBadge(status: string) {
    if (status === 'pending_transfer') {
      return (
        <span
          className="inline-flex items-center rounded-full bg-accent-50 px-2 py-0.5 text-[11px] font-bold text-accent-700"
          style={{ border: '1px solid var(--color-accent-200)' }}
        >
          입금 대기
        </span>
      )
    }
    if (status === 'confirmed') {
      return (
        <span
          className="inline-flex items-center rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-bold text-primary-700"
          style={{ border: '1px solid var(--color-primary-100)' }}
        >
          결제완료
        </span>
      )
    }
    if (status === 'waitlisted') {
      return (
        <span
          className="inline-flex items-center rounded-full bg-accent-50 px-2 py-0.5 text-[11px] font-bold text-accent-700"
          style={{ border: '1px solid var(--color-accent-200)' }}
        >
          대기 중
        </span>
      )
    }
    if (status === 'waitlist_cancelled') {
      return (
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold text-primary-400"
          style={{ backgroundColor: 'var(--color-surface-200)', border: '1px solid var(--color-surface-300)' }}
        >
          대기 취소
        </span>
      )
    }
    if (status === 'waitlist_refunded') {
      return (
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold text-primary-400"
          style={{ backgroundColor: 'var(--color-surface-200)', border: '1px solid var(--color-surface-300)' }}
        >
          대기 환불
        </span>
      )
    }
    return (
      <span
        className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold text-primary-400"
        style={{ backgroundColor: 'var(--color-surface-200)', border: '1px solid var(--color-surface-300)' }}
      >
        취소됨
      </span>
    )
  }

  function getPaymentMethodLabel(method: string | null | undefined) {
    if (method === 'transfer') return '이체'
    if (method === 'card') return '카드'
    return null
  }

  function getTransferCancelInfo(reg: RegistrationWithProfile): {
    label: string
    refundText: string | null
    phone: string | null
  } | null {
    if (reg.status !== 'cancelled' || reg.payment_method !== 'transfer') return null

    // 미입금 취소: pending_transfer → cancelled (refunded_amount = 0)
    if (reg.refunded_amount === 0) {
      return { label: '미입금 취소', refundText: null, phone: null }
    }

    // 입금 확인 후 취소: confirmed → cancelled (refunded_amount = null)
    if (reg.refunded_amount === null) {
      const cancelDate = reg.cancelled_at
        ? toKSTDate(new Date(reg.cancelled_at))
        : getKSTToday()
      const { refundAmount } = calculateRefund(
        meetingDate,
        reg.paid_amount ?? 0,
        cancelDate,
      )
      return {
        label: '환불 필요',
        refundText: `${formatFee(refundAmount)}원`,
        phone: reg.profiles?.phone ?? null,
      }
    }

    // refunded_amount > 0: 이미 환불 완료 → 기존 로직 사용
    return null
  }

  function getAmountSubtext(reg: RegistrationWithProfile) {
    if (reg.status === 'pending_transfer' && reg.paid_amount) {
      return (
        <div className="text-xs text-accent-500/70 mt-0.5">
          {formatFee(reg.paid_amount)}원 (입금 대기)
        </div>
      )
    }
    if (reg.status === 'confirmed' && reg.paid_amount) {
      return (
        <div className="text-xs text-primary-500/70 mt-0.5">
          {formatFee(reg.paid_amount)}원
        </div>
      )
    }
    if (reg.status === 'cancelled') {
      const transferInfo = getTransferCancelInfo(reg)
      if (transferInfo) {
        return (
          <div className="mt-0.5">
            <div className="text-xs text-accent-600 font-medium">{transferInfo.label}</div>
            {transferInfo.refundText && (
              <div className="text-xs text-primary-400">환불 {transferInfo.refundText}</div>
            )}
            {transferInfo.phone && (
              <div className="text-xs text-primary-400">{transferInfo.phone}</div>
            )}
            {reg.cancelled_at && (
              <div className="text-xs text-primary-400">{formatDate(reg.cancelled_at)}</div>
            )}
          </div>
        )
      }
      return (
        <div className="mt-0.5">
          {reg.refunded_amount ? (
            <div className="text-xs text-primary-400">환불 {formatFee(reg.refunded_amount)}원</div>
          ) : null}
          {reg.cancel_type && (
            <div className="text-xs text-primary-400">
              ({CANCEL_TYPE_LABELS[reg.cancel_type] ?? reg.cancel_type})
            </div>
          )}
          {reg.cancelled_at && (
            <div className="text-xs text-primary-400">{formatDate(reg.cancelled_at)}</div>
          )}
        </div>
      )
    }
    if ((reg.status === 'waitlisted' || reg.status === 'waitlist_cancelled' || reg.status === 'waitlist_refunded') && reg.paid_amount) {
      return (
        <div className="mt-0.5">
          <div className="text-xs text-primary-500/70">{formatFee(reg.paid_amount)}원</div>
          {reg.refunded_amount ? (
            <div className="text-xs text-primary-400">환불 {formatFee(reg.refunded_amount)}원</div>
          ) : null}
        </div>
      )
    }
    return null
  }

  function getDisplayName(reg: RegistrationWithProfile) {
    return reg.profiles?.real_name
      ? `${reg.profiles.real_name} (${reg.profiles.nickname})`
      : reg.profiles?.nickname || '(알 수 없음)'
  }

  function getQueueNumber(regs: RegistrationWithProfile[], reg: RegistrationWithProfile, idx: number) {
    if (reg.status !== 'waitlisted') return null
    return regs.filter((r, i) => i <= idx && r.status === 'waitlisted').length
  }

  function renderToggle(reg: RegistrationWithProfile, showQueueNumber: boolean) {
    if (reg.status === 'pending_transfer') {
      return <DepositToggle registrationId={reg.id} isDeposited={false} />
    }
    if (reg.status === 'confirmed' && reg.payment_method === 'transfer') {
      return <DepositToggle registrationId={reg.id} isDeposited={true} />
    }
    if (!showQueueNumber && showAttendance && reg.status === 'confirmed') {
      return <AttendanceToggle registrationId={reg.id} attended={reg.attended} />
    }
    return null
  }

  function getMobileAmountLine(reg: RegistrationWithProfile) {
    if (reg.status === 'cancelled') {
      const transferInfo = getTransferCancelInfo(reg)
      if (transferInfo) {
        const parts: string[] = [transferInfo.label]
        if (transferInfo.refundText) parts.push(`환불 ${transferInfo.refundText}`)
        if (transferInfo.phone) parts.push(transferInfo.phone)
        if (reg.cancelled_at) parts.push(formatDate(reg.cancelled_at))
        return parts.join('  ')
      }
      const parts: string[] = []
      if (reg.refunded_amount) parts.push(`환불 ${formatFee(reg.refunded_amount)}원`)
      if (reg.cancel_type) parts.push(`(${CANCEL_TYPE_LABELS[reg.cancel_type] ?? reg.cancel_type})`)
      if (reg.cancelled_at) parts.push(formatDate(reg.cancelled_at))
      return parts.length > 0 ? parts.join('  ') : null
    }
    return null
  }

  function renderMobileCards(regs: RegistrationWithProfile[], showQueueNumber: boolean) {
    return (
      <div className="md:hidden space-y-2">
        {regs.map((reg, idx) => {
          const queueNum = showQueueNumber ? getQueueNumber(regs, reg, idx) : null
          const toggle = renderToggle(reg, showQueueNumber)
          const cancelDetail = getMobileAmountLine(reg)

          return (
            <div
              key={reg.id}
              className="rounded-[var(--radius-md)] p-3"
              style={{ backgroundColor: 'var(--color-surface-50)', border: '1px solid var(--color-surface-200)' }}
            >
              {/* Row 1: name + badges */}
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium text-primary-800 truncate min-w-0">
                  {queueNum !== null && (
                    <span className="text-xs font-bold text-accent-500 mr-1.5">#{queueNum}</span>
                  )}
                  {getDisplayName(reg)}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {getStatusBadge(reg.status)}
                  {getPaymentMethodLabel(reg.payment_method) && (
                    <span className="text-[10px] text-primary-400">
                      {getPaymentMethodLabel(reg.payment_method)}
                    </span>
                  )}
                </div>
              </div>
              {/* Row 2: date + amount + toggle */}
              <div className="flex items-center justify-between mt-1.5">
                <div className="text-xs text-primary-500">
                  {formatDate(reg.created_at)}
                  {reg.paid_amount ? (
                    <span className="text-primary-500/70"> · {formatFee(reg.paid_amount)}원</span>
                  ) : null}
                  {cancelDetail && (
                    <span className="text-primary-400 ml-1.5">{cancelDetail}</span>
                  )}
                </div>
                {toggle && (
                  <div className="shrink-0 ml-2">{toggle}</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  function renderDesktopTable(regs: RegistrationWithProfile[], showQueueNumber: boolean) {
    return (
      <div
        className="hidden md:block rounded-[var(--radius-md)] overflow-hidden"
        style={{
          border: '1px solid var(--color-surface-300)',
        }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-surface-300)', backgroundColor: 'var(--color-surface-100)' }}>
              {showQueueNumber && (
                <th className="px-2 py-2.5 text-center text-xs font-bold text-primary-500">
                  #
                </th>
              )}
              <th className="px-4 py-2.5 text-left text-xs font-bold text-primary-500">
                이름
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-bold text-primary-500">
                신청일
              </th>
              <th className="px-4 py-2.5 text-right text-xs font-bold text-primary-500">
                상태
              </th>
              {!showQueueNumber && showAttendance && (
                <th className="px-2 py-2.5 text-center text-xs font-bold text-primary-500">
                  참석
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {regs.map((reg, idx) => (
              <tr
                key={reg.id}
                style={{ borderBottom: '1px solid var(--color-surface-200)', backgroundColor: 'var(--color-surface-50)' }}
                className="last:border-b-0"
              >
                {showQueueNumber && (
                  <td className="px-2 py-3 text-center text-xs font-bold text-accent-500">
                    {reg.status === 'waitlisted'
                      ? regs.filter((r, i) => i <= idx && r.status === 'waitlisted').length
                      : '-'}
                  </td>
                )}
                <td className="px-4 py-3 text-sm font-medium text-primary-800">
                  {getDisplayName(reg)}
                </td>
                <td className="px-4 py-3 text-sm text-primary-500/70">
                  {formatDate(reg.created_at)}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1.5">
                      {getStatusBadge(reg.status)}
                      {getPaymentMethodLabel(reg.payment_method) && (
                        <span className="text-[10px] text-primary-400">
                          {getPaymentMethodLabel(reg.payment_method)}
                        </span>
                      )}
                    </div>
                    {reg.status === 'pending_transfer' && (
                      <DepositToggle registrationId={reg.id} isDeposited={false} />
                    )}
                    {reg.status === 'confirmed' && reg.payment_method === 'transfer' && (
                      <DepositToggle registrationId={reg.id} isDeposited={true} />
                    )}
                    {getAmountSubtext(reg)}
                  </div>
                </td>
                {!showQueueNumber && showAttendance && (
                  <td className="px-2 py-1 text-center">
                    {reg.status === 'confirmed' ? (
                      <AttendanceToggle
                        registrationId={reg.id}
                        attended={reg.attended}
                      />
                    ) : (
                      <span className="text-primary-300">-</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div
      className="mt-8 rounded-[var(--radius-lg)] p-4"
      style={{ backgroundColor: 'var(--color-surface-100)' }}
    >
      <h2 className="text-sm font-bold text-primary-800 mb-4 tracking-tight">
        운영자 관리
      </h2>

      {/* Action buttons — Edit prominent, Delete subtle below */}
      <div className="mb-6">
        <Link
          href={`/admin/meetings/${meetingId}/edit`}
          className="block w-full rounded-[var(--radius-md)] bg-primary-600 py-3 text-center text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-700 active:scale-[0.98]"
        >
          수정
        </Link>
        {role === 'admin' && (
          <div className="mt-3">
            <DeleteMeetingButton
              meetingId={meetingId}
              meetingStatus={meetingStatus}
              confirmedCount={confirmedCount}
            />
          </div>
        )}
      </div>

      {/* 결제/환불 요약 카드 */}
      {confirmedRegs.length > 0 && (
        <div
          className="mb-5 rounded-[var(--radius-md)] px-4 py-3"
          style={{ border: '1px solid var(--color-surface-300)', backgroundColor: 'var(--color-surface-50)' }}
        >
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-xs text-primary-500 mb-1">총 결제</div>
              <div className="text-sm font-bold text-primary-800">{formatFee(totalPaid)}원</div>
            </div>
            <div>
              <div className="text-xs text-primary-500 mb-1">환불</div>
              <div className="text-sm font-bold text-primary-800">{formatFee(totalRefunded)}원</div>
            </div>
            <div>
              <div className="text-xs text-primary-500 mb-1">순매출</div>
              <div className="text-sm font-bold text-primary-800">{formatFee(netRevenue)}원</div>
            </div>
          </div>
          {showAttendance && confirmedCount > 0 && (
            <div className="mt-2.5 pt-2.5 text-center text-xs text-primary-500" style={{ borderTop: '1px solid var(--color-surface-300)' }}>
              참석률 {Math.round((attendedCount / confirmedCount) * 100)}% ({attendedCount}/{confirmedCount}명)
            </div>
          )}
        </div>
      )}

      {/* Confirmed registrant list */}
      <div>
        <h3 className="text-xs font-bold text-primary-500 mb-3 tracking-tight">
          신청자 목록 ({confirmedCount}명 확정{confirmedRegs.length > confirmedCount ? ` · ${confirmedRegs.length - confirmedCount}명 취소` : ''})
        </h3>
        {confirmedRegs.length === 0 ? (
          <p className="text-sm text-primary-400 text-center py-8">
            아직 신청자가 없습니다
          </p>
        ) : (
          <>
            {renderMobileCards(confirmedRegs, false)}
            {renderDesktopTable(confirmedRegs, false)}
          </>
        )}
      </div>

      {/* Waitlisted registrant list */}
      {waitlistedRegs.length > 0 && (
        <div className="mt-6">
          <h3 className="text-xs font-bold text-accent-500 mb-3 tracking-tight">
            대기자 목록 ({waitlistedRegs.filter((r) => r.status === 'waitlisted').length}명)
          </h3>
          {renderMobileCards(waitlistedRegs, true)}
          {renderDesktopTable(waitlistedRegs, true)}
        </div>
      )}
    </div>
  )
}
