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
    <div className="mt-8 border-t border-gray-100 pt-6">
      <h2 className="text-sm font-semibold text-gray-900 mb-4">
        운영자 관리
      </h2>

      {/* Action buttons */}
      <div className="flex gap-2 mb-6">
        <Link
          href={`/admin/meetings/${meetingId}/edit`}
          className="flex-1 rounded-[var(--radius-md)] border border-gray-200 bg-white py-2.5 text-center text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          수정
        </Link>
        <div className="flex-1">
          <DeleteMeetingButton
            meetingId={meetingId}
            meetingStatus={meetingStatus}
            confirmedCount={confirmedCount}
          />
        </div>
      </div>

      {/* Registrant list table */}
      <div>
        <h3 className="text-xs font-medium text-gray-500 mb-3">
          신청자 목록 ({confirmedCount}명)
        </h3>
        <div className="rounded-[var(--radius-md)] border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">
                  이름
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">
                  신청일
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500">
                  상태
                </th>
              </tr>
            </thead>
            <tbody>
              {registrations.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-8 text-center text-sm text-gray-400"
                  >
                    아직 신청자가 없습니다
                  </td>
                </tr>
              ) : (
                registrations.map((reg) => (
                  <tr
                    key={reg.id}
                    className="border-b border-gray-50 last:border-b-0"
                  >
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {reg.profiles?.nickname || '(알 수 없음)'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatDate(reg.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {reg.status === 'confirmed' ? (
                        <span className="inline-flex items-center rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                          결제완료
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                          취소됨
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
