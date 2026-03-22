import Link from 'next/link'
import DeleteMeetingButton from './DeleteMeetingButton'
import AttendanceToggle from './AttendanceToggle'
import { getKSTToday } from '@/lib/kst'
import type { RegistrationWithProfile } from '@/types/registration'

type Props = {
  meetingId: string
  meetingStatus: string
  confirmedCount: number
  registrations: RegistrationWithProfile[]
  role: string
  meetingDate: string
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

  const confirmedRegs = registrations.filter((r) => r.status === 'confirmed' || r.status === 'cancelled')
  const waitlistedRegs = registrations
    .filter((r) => r.status === 'waitlisted' || r.status === 'waitlist_cancelled' || r.status === 'waitlist_refunded')
    .sort((a, b) => a.created_at.localeCompare(b.created_at))

  function getStatusBadge(status: string) {
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

  function renderTable(regs: RegistrationWithProfile[], showQueueNumber: boolean) {
    return (
      <div
        className="rounded-[var(--radius-md)] overflow-hidden"
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
                  {reg.profiles?.real_name
                    ? `${reg.profiles.real_name} (${reg.profiles.nickname})`
                    : reg.profiles?.nickname || '(알 수 없음)'}
                </td>
                <td className="px-4 py-3 text-sm text-primary-500/70">
                  {formatDate(reg.created_at)}
                </td>
                <td className="px-4 py-3 text-right">
                  {getStatusBadge(reg.status)}
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

      {/* Confirmed registrant list */}
      <div>
        <h3 className="text-xs font-bold text-primary-500 mb-3 tracking-tight">
          신청자 목록 ({confirmedCount}명)
        </h3>
        {confirmedRegs.length === 0 ? (
          <p className="text-sm text-primary-400 text-center py-8">
            아직 신청자가 없습니다
          </p>
        ) : (
          renderTable(confirmedRegs, false)
        )}
      </div>

      {/* Waitlisted registrant list */}
      {waitlistedRegs.length > 0 && (
        <div className="mt-6">
          <h3 className="text-xs font-bold text-accent-500 mb-3 tracking-tight">
            대기자 목록 ({waitlistedRegs.filter((r) => r.status === 'waitlisted').length}명)
          </h3>
          {renderTable(waitlistedRegs, true)}
        </div>
      )}
    </div>
  )
}
