import Link from 'next/link'
import DeleteMeetingButton from './DeleteMeetingButton'
import type { RegistrationWithProfile } from '@/types/registration'

type Props = {
  meetingId: string
  meetingStatus: string
  confirmedCount: number
  registrations: RegistrationWithProfile[]
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
}: Props) {
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
          className="block w-full rounded-[var(--radius-md)] py-2.5 text-center text-sm font-bold transition-all hover:bg-primary-50 active:scale-[0.98]"
          style={{
            backgroundColor: 'var(--color-surface-50)',
            border: '1px solid var(--color-surface-300)',
            color: 'var(--color-primary-600)',
          }}
        >
          수정
        </Link>
        <div className="mt-2">
          <DeleteMeetingButton
            meetingId={meetingId}
            meetingStatus={meetingStatus}
            confirmedCount={confirmedCount}
          />
        </div>
      </div>

      {/* Registrant list */}
      <div>
        <h3 className="text-xs font-bold text-primary-500 mb-3 tracking-tight">
          신청자 목록 ({confirmedCount}명)
        </h3>
        {registrations.length === 0 ? (
          <p className="text-sm text-primary-400 text-center py-8">
            아직 신청자가 없습니다
          </p>
        ) : (
          <div
            className="rounded-[var(--radius-md)] overflow-hidden"
            style={{
              border: '1px solid var(--color-surface-300)',
            }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-surface-300)', backgroundColor: 'var(--color-surface-100)' }}>
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
                {registrations.map((reg) => (
                  <tr
                    key={reg.id}
                    style={{ borderBottom: '1px solid var(--color-surface-200)', backgroundColor: 'var(--color-surface-50)' }}
                    className="last:border-b-0"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-primary-800">
                      {reg.profiles?.nickname || '(알 수 없음)'}
                    </td>
                    <td className="px-4 py-3 text-sm text-primary-500/70">
                      {formatDate(reg.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {reg.status === 'confirmed' ? (
                        <span
                          className="inline-flex items-center rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-bold text-primary-700"
                          style={{ border: '1px solid var(--color-primary-100)' }}
                        >
                          결제완료
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold text-primary-400"
                          style={{ backgroundColor: 'var(--color-surface-200)', border: '1px solid var(--color-surface-300)' }}
                        >
                          취소됨
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
