import DepositToggle from '@/components/admin/DepositToggle'
import RefundToggle from '@/components/admin/RefundToggle'
import { getKSTToday, formatFee, toKSTDate } from '@/lib/kst'
import { calculateRefundByType } from '@/lib/refund'
import type { RegistrationWithProfile } from '@/types/registration'

type Props = {
  confirmedCount: number
  registrations: RegistrationWithProfile[]
  meetingDate: string
  meetingType: string | null
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

/**
 * 운영자 모임 상세의 신청자 영역. 수정·삭제 버튼은 2026-10-09에 페이지로 옮겼다
 * (수정 = 오른쪽 위 작은 버튼, 삭제 = 맨 아래 빨간 구역). 금액은 숫자만.
 */
export default function AdminMeetingSection({
  confirmedCount,
  registrations,
  meetingDate,
  meetingType,
}: Props) {
  const confirmedRegs = registrations.filter((r) => r.status === 'confirmed' || r.status === 'cancelled' || r.status === 'pending_transfer')
  const waitlistedRegs = registrations
    .filter((r) => r.status === 'waitlisted' || r.status === 'waitlist_cancelled' || r.status === 'waitlist_refunded')
    .sort((a, b) => a.created_at.localeCompare(b.created_at))

  // 요약 통계 계산
  // 총 결제: 실제 입금 확인된 건만 집계 — pending_transfer(입금 대기)는 제외.
  // 대시보드/정산과 동일 기준(confirmed + cancelled)으로 정합성 유지.
  const totalPaid = confirmedRegs
    .filter((r) => r.status === 'confirmed' || r.status === 'cancelled')
    .reduce((sum, r) => sum + (r.paid_amount ?? 0), 0)
  const totalRefunded = confirmedRegs
    .filter((r) => r.status === 'cancelled' && r.refunded_amount)
    .reduce((sum, r) => sum + (r.refunded_amount ?? 0), 0)
  const netRevenue = totalPaid - totalRefunded

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
      const { refundAmount } = calculateRefundByType(
        meetingType,
        meetingDate,
        reg.paid_amount ?? 0,
        cancelDate,
      )
      return {
        label: '환불 필요',
        refundText: `${formatFee(refundAmount)}`,
        phone: reg.profiles?.phone ?? null,
      }
    }

    // refunded_amount > 0: 이미 환불 완료 → 기존 로직 사용
    return null
  }

  function getAmountSubtext(reg: RegistrationWithProfile) {
    if (reg.status === 'pending_transfer' && reg.paid_amount) {
      return (
        <div className="mt-0.5">
          <div className="text-xs text-accent-500/70">
            {formatFee(reg.paid_amount)} (입금 대기)
          </div>
          {reg.is_staff_discount && (
            <div className="text-[11px] text-primary-600 font-semibold">스텝 50%</div>
          )}
        </div>
      )
    }
    if (reg.status === 'confirmed' && reg.paid_amount) {
      return (
        <div className="mt-0.5">
          <div className="text-xs text-primary-500/70">
            {formatFee(reg.paid_amount)}
          </div>
          {reg.is_staff_discount && (
            <div className="text-[11px] text-primary-600 font-semibold">스텝 50%</div>
          )}
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
            <div className="text-xs text-primary-400">환불 {formatFee(reg.refunded_amount)}</div>
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
          <div className="text-xs text-primary-500/70">{formatFee(reg.paid_amount)}</div>
          {reg.is_staff_discount && (
            <div className="text-[11px] text-primary-600 font-semibold">스텝 50%</div>
          )}
          {reg.refunded_amount ? (
            <div className="text-xs text-primary-400">환불 {formatFee(reg.refunded_amount)}</div>
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

  function renderToggle(reg: RegistrationWithProfile) {
    if (reg.status === 'pending_transfer') {
      return <DepositToggle registrationId={reg.id} isDeposited={false} />
    }
    if (reg.status === 'confirmed' && reg.payment_method === 'transfer') {
      return <DepositToggle registrationId={reg.id} isDeposited={true} />
    }
    // Phase 3 M7 Step 2.6: 계좌이체 취소 건의 환불 완료 토글
    // 미입금 취소(refunded_amount=0)는 환불 대상 아니므로 토글 안 보임
    if (
      reg.status === 'cancelled' &&
      reg.payment_method === 'transfer' &&
      reg.refunded_amount !== 0
    ) {
      return (
        <RefundToggle
          registrationId={reg.id}
          isRefunded={reg.refunded_amount !== null && reg.refunded_amount > 0}
        />
      )
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
      if (reg.refunded_amount) parts.push(`환불 ${formatFee(reg.refunded_amount)}`)
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
          const toggle = renderToggle(reg)
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
                    <span className="text-primary-500/70"> · {formatFee(reg.paid_amount)}</span>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="mt-10">
      {/* Confirmed registrant list */}
      <div>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-[17px] font-extrabold tracking-tight text-neutral-900">
            신청자
            <span className="ml-1.5 text-sm font-semibold text-neutral-600">
              {confirmedCount}명
              {confirmedRegs.length > confirmedCount
                ? ` · 취소 ${confirmedRegs.length - confirmedCount}명`
                : ''}
            </span>
          </h2>
          <small className="text-xs text-neutral-600">최근 신청 순</small>
        </div>
        {confirmedRegs.length === 0 ? (
          <p className="text-sm text-primary-400 text-center py-8">
            아직 신청자가 없습니다
          </p>
        ) : (
          <>
            {renderMobileCards(confirmedRegs, false)}
            {renderDesktopTable(confirmedRegs, false)}
            {/* 결제/환불 요약 — 숫자만 */}
            <p className="mt-3.5 text-[13px] text-neutral-600">
              총 결제 <b className="font-bold text-neutral-800">{formatFee(totalPaid)}</b>
              <span className="mx-2 text-neutral-400">·</span>
              환불 <b className="font-bold text-neutral-800">{formatFee(totalRefunded)}</b>
              <span className="mx-2 text-neutral-400">·</span>
              순매출 <b className="font-bold text-neutral-800">{formatFee(netRevenue)}</b>
            </p>
          </>
        )}
      </div>

      {/* Waitlisted registrant list */}
      {waitlistedRegs.length > 0 && (
        <div className="mt-8">
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
