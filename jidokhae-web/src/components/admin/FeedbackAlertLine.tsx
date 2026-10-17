import Link from 'next/link'
import type { FeedbackAlert } from '@/lib/member-feedback'

/**
 * 대시보드 긴급 칸 — 「새 회원 의견 N건」 (2026-10-17). 판정은 `feedbackAlert`(lib/member-feedback.ts).
 * 총괄은 누르면 목록으로, 운영진은 건수만(목록은 총괄 전용).
 */
export default function FeedbackAlertLine({ alert }: { alert: FeedbackAlert }) {
  if (!alert.show) return null

  const body = (
    <span className="flex items-center gap-2">
      <span className="text-xs font-bold uppercase tracking-wider text-primary-600">의견</span>
      <span>{alert.text}</span>
    </span>
  )
  // 돈·발송 사고가 아니라 읽을 거리라 빨간 면을 쓰지 않는다. 그린은 점(글자)만 — 면은 회색 (디자인 토큰 규율)
  const boxStyle = { backgroundColor: 'var(--color-neutral-50)', border: '1px solid var(--color-neutral-200)' }

  if (alert.href) {
    return (
      <Link
        href={alert.href}
        className="flex items-center justify-between rounded-[var(--radius-md)] px-4 py-3 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-100"
        style={boxStyle}
      >
        {body}
        <span className="text-xs font-bold text-primary-700">읽기 →</span>
      </Link>
    )
  }
  return (
    <div
      className="flex items-center justify-between rounded-[var(--radius-md)] px-4 py-3 text-sm font-medium text-neutral-800"
      style={boxStyle}
    >
      {body}
      {alert.note && <span className="text-xs text-neutral-500">{alert.note}</span>}
    </div>
  )
}
