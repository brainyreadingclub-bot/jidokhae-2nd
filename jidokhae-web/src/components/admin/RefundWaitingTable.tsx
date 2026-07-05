import { formatFee } from '@/lib/kst'
import { formatKSTDateTime } from '@/lib/settlement'
import type { RefundRow } from '@/lib/settlement'
import RefundToggle from '@/components/admin/RefundToggle'

type Props = {
  rows: RefundRow[]
}

// "YYYY-MM-DD" → "M/D" 표시
function formatMeetingDate(dateStr: string): string {
  const parts = dateStr.split('-')
  if (parts.length < 3) return dateStr
  return `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}`
}

export default function RefundWaitingTable({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-neutral-400">
        환불 대기 중인 건이 없습니다.
      </p>
    )
  }

  return (
    <div>
      {/* 안내 문구 */}
      <p className="mb-3 text-xs text-neutral-400">
        계좌이체 환불은 회원 연락처로 계좌번호를 확인한 뒤 직접 송금하고, 완료 후 환불 완료를 체크하세요.
      </p>

      {/* 모바일 카드 목록 */}
      <div className="md:hidden space-y-2">
        {rows.map((row) => (
          <div
            key={row.id}
            className="rounded-[var(--radius-md)] p-3"
            style={{ backgroundColor: 'var(--color-surface-50)', border: '1px solid var(--color-surface-200)' }}
          >
            {/* Row 1: 닉네임 + 환불액 */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-primary-800 truncate min-w-0">
                {row.nickname}
              </span>
              <span className="text-sm font-bold text-primary-800 shrink-0">
                {formatFee(row.refundAmount)}원
              </span>
            </div>
            {/* Row 2: 모임 + 날짜 */}
            <div className="mt-1 text-xs text-primary-600 truncate">
              {row.meetingTitle != null ? (
                <span>{row.meetingTitle}</span>
              ) : (
                <span className="text-neutral-400">삭제된 모임</span>
              )}
              {row.meetingDate && (
                <span className="text-neutral-400 ml-1">({formatMeetingDate(row.meetingDate)})</span>
              )}
            </div>
            {/* Row 3: 취소 시각 + 연락처 + 환불 완료 토글 */}
            <div className="flex items-center justify-between mt-1.5 gap-2">
              <div className="text-xs text-neutral-500 min-w-0">
                {row.cancelledAt ? (
                  <span>{formatKSTDateTime(row.cancelledAt)} 취소</span>
                ) : (
                  <span>-</span>
                )}
                {row.phone && (
                  <span className="ml-1.5 text-neutral-400">{row.phone}</span>
                )}
              </div>
              <div className="shrink-0">
                <RefundToggle registrationId={row.id} isRefunded={false} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 데스크톱 테이블 */}
      <div
        className="hidden md:block rounded-[var(--radius-md)] overflow-x-auto"
        style={{ border: '1px solid var(--color-surface-300)' }}
      >
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr
              style={{
                borderBottom: '1px solid var(--color-surface-300)',
                backgroundColor: 'var(--color-surface-100)',
              }}
            >
              <th className="px-3 py-2.5 text-left text-xs font-bold text-primary-500">닉네임</th>
              <th className="px-3 py-2.5 text-right text-xs font-bold text-primary-500">환불액</th>
              <th className="px-3 py-2.5 text-left text-xs font-bold text-primary-500">취소 시각</th>
              <th className="px-3 py-2.5 text-left text-xs font-bold text-primary-500">모임</th>
              <th className="px-3 py-2.5 text-left text-xs font-bold text-primary-500">모임 날짜</th>
              <th className="px-3 py-2.5 text-left text-xs font-bold text-primary-500">연락처</th>
              <th className="px-3 py-2.5 text-center text-xs font-bold text-primary-500">환불 완료</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                style={{
                  borderBottom: '1px solid var(--color-surface-200)',
                  backgroundColor: 'var(--color-surface-50)',
                }}
              >
                {/* 닉네임 */}
                <td className="px-3 py-2.5 font-medium text-primary-800 whitespace-nowrap">
                  {row.nickname}
                </td>
                {/* 환불액 */}
                <td className="px-3 py-2.5 text-right text-primary-800 whitespace-nowrap">
                  {formatFee(row.refundAmount)}원
                </td>
                {/* 취소 시각 */}
                <td className="px-3 py-2.5 text-neutral-600 whitespace-nowrap">
                  {row.cancelledAt ? formatKSTDateTime(row.cancelledAt) : '-'}
                </td>
                {/* 모임 */}
                <td className="px-3 py-2.5 max-w-[160px] truncate">
                  {row.meetingTitle != null ? (
                    <span className="text-primary-700">{row.meetingTitle}</span>
                  ) : (
                    <span className="text-neutral-400">삭제된 모임</span>
                  )}
                </td>
                {/* 모임 날짜 */}
                <td className="px-3 py-2.5 text-neutral-600 whitespace-nowrap">
                  {row.meetingDate ? formatMeetingDate(row.meetingDate) : '-'}
                </td>
                {/* 연락처 */}
                <td className="px-3 py-2.5 text-neutral-500">
                  {row.phone ?? '-'}
                </td>
                {/* 환불 완료 토글 */}
                <td className="px-3 py-2.5 text-center">
                  <RefundToggle registrationId={row.id} isRefunded={false} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
