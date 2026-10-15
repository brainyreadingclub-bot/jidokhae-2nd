import Link from 'next/link'
import { formatFee } from '@/lib/kst'
import { formatKSTDateTime } from '@/lib/settlement'
import type { CancelledBeforeDepositRow } from '@/lib/settlement'

type Props = {
  rows: CancelledBeforeDepositRow[]
}

// "YYYY-MM-DD" → "M/D"
function formatMeetingDate(dateStr: string): string {
  const parts = dateStr.split('-')
  if (parts.length < 3) return dateStr
  return `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}`
}

function MeetingCell({ row }: { row: CancelledBeforeDepositRow }) {
  return (
    <>
      {row.meetingTitle == null ? (
        <span className="text-neutral-400">삭제된 모임</span>
      ) : row.meetingId && !row.meetingDeleted ? (
        <Link
          href={`/admin/meetings/${row.meetingId}`}
          target="_blank"
          className="underline underline-offset-2 hover:text-primary-800"
        >
          {row.meetingTitle}
        </Link>
      ) : (
        <span>{row.meetingTitle} <span className="text-neutral-400">(취소된 모임)</span></span>
      )}
      {row.meetingDate && (
        <span className="ml-1 text-neutral-400">({formatMeetingDate(row.meetingDate)})</span>
      )}
    </>
  )
}

// 입금 전 취소 — 읽기 전용. 월말에 통장과 맞춰 보는 용도라 환불 처리 버튼을 두지 않는다 (2026-10-15 대표님 1안)
// 지난 건이 쌓이므로 접어 두고, 펼쳐도 높이를 묶어 스크롤한다
export default function CancelledBeforeDepositList({ rows }: Props) {
  if (rows.length === 0) return null

  return (
    <details className="mt-8 group">
      <summary className="cursor-pointer list-none text-xs font-semibold text-neutral-500 hover:text-primary-700">
        <span className="group-open:hidden">▸</span>
        <span className="hidden group-open:inline">▾</span> 입금 전 취소 {rows.length}건 보기
      </summary>
      <p className="mt-2 text-xs text-neutral-500 break-keep">
        입금 확인 전에 취소된 계좌이체 신청이에요. 통장에 이 회원의 입금이 있으면 「입금했다면 돌려줄 금액」만큼 돌려주세요. 읽기 전용 목록이에요.
      </p>

      {/* 모바일 카드 */}
      <div className="mt-3 md:hidden max-h-[480px] overflow-y-auto space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="rounded-[var(--radius-md)] border border-neutral-200 p-3">
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-medium text-primary-800 truncate min-w-0">{row.nickname}</span>
              <span className="shrink-0 text-right">
                <span className="block text-[11px] text-neutral-500">입금했다면 돌려줄 금액</span>
                <span className="block text-base font-bold text-primary-800">{formatFee(row.refundIfDeposited)}</span>
                <span className="block text-[11px] text-neutral-400">참가비 {formatFee(row.paidAmount)}</span>
              </span>
            </div>
            <div className="mt-1 text-xs text-primary-600"><MeetingCell row={row} /></div>
            <div className="mt-1 text-xs text-neutral-500">{row.cancelledAt ? formatKSTDateTime(row.cancelledAt) : '-'} 취소</div>
          </div>
        ))}
      </div>

      {/* 데스크톱 표 */}
      <div className="mt-3 hidden md:block max-h-[480px] overflow-y-auto rounded-[var(--radius-md)] border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-neutral-50">
            <tr className="border-b border-neutral-200 text-left text-xs font-bold text-primary-500">
              <th className="px-3 py-2">취소 시각</th>
              <th className="px-3 py-2">모임</th>
              <th className="px-3 py-2">닉네임</th>
              <th className="px-3 py-2 text-right">참가비</th>
              <th className="px-3 py-2 text-right">입금했다면 돌려줄 금액</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-neutral-100 last:border-0 align-top">
                <td className="px-3 py-2 text-xs text-neutral-500 whitespace-nowrap">
                  {row.cancelledAt ? formatKSTDateTime(row.cancelledAt) : '-'}
                </td>
                <td className="px-3 py-2 text-xs text-primary-700">
                  <MeetingCell row={row} />
                </td>
                <td className="px-3 py-2 text-xs font-medium text-primary-800">{row.nickname}</td>
                <td className="px-3 py-2 text-right text-xs text-neutral-600 whitespace-nowrap">
                  {formatFee(row.paidAmount)}
                </td>
                <td className="px-3 py-2 text-right text-xs font-bold text-primary-800 whitespace-nowrap">
                  {formatFee(row.refundIfDeposited)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
