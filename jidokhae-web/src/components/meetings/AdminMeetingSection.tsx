import Link from 'next/link'
import DeleteMeetingButton from './DeleteMeetingButton'

type Props = {
  meetingId: string
  confirmedCount: number
}

export default function AdminMeetingSection({
  meetingId,
  confirmedCount,
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
            confirmedCount={confirmedCount}
          />
        </div>
      </div>

      {/* Registrant list table */}
      <div>
        <h3 className="text-xs font-medium text-gray-500 mb-3">
          신청자 목록
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
              {confirmedCount === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-8 text-center text-sm text-gray-400"
                  >
                    아직 신청자가 없습니다
                  </td>
                </tr>
              ) : (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-8 text-center text-sm text-gray-400"
                  >
                    신청자 {confirmedCount}명 (상세 목록은 준비 중)
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
