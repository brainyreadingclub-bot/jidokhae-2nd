import { formatKSTDateTime } from '@/lib/settlement'
import {
  FEEDBACK_CATEGORY_LABELS,
  FEEDBACK_LIST_LIMIT,
  FEEDBACK_SOURCE_LABELS,
  type FeedbackListResult,
} from '@/lib/member-feedback'

/** 회원 의견 목록 — 표시만 한다. 조회는 `/admin/feedback` 페이지가 `listMemberFeedback`으로 */
export default function MemberFeedbackList({ result }: { result: FeedbackListResult }) {
  return (
    <>
      {result.status === 'table_missing' ? (
        <p className="rounded-[var(--radius-md)] border border-neutral-200 bg-white p-4 text-sm text-neutral-600 break-keep">
          의견 표가 아직 없음 — <code>supabase/migration-member-feedback.sql</code> 실행 전. 그동안 들어온 글은 남지 않는다.
        </p>
      ) : result.rows.length === 0 ? (
        <p className="rounded-[var(--radius-md)] border border-neutral-200 bg-white p-4 text-sm text-neutral-600">
          들어온 의견 없음
        </p>
      ) : (
        <section>
          <h2 className="text-sm font-semibold text-neutral-700">
            총 {result.total}건
            {result.total > result.rows.length && ` · 최근 ${FEEDBACK_LIST_LIMIT}건만 표시`}
          </h2>
          <ul className="mt-3 space-y-3">
            {result.rows.map((f) => (
              <li
                key={f.id}
                className="rounded-[var(--radius-md)] border border-neutral-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500">
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-semibold text-neutral-700">
                    {FEEDBACK_CATEGORY_LABELS[f.category] ?? f.category}
                  </span>
                  <span>{formatKSTDateTime(f.created_at)}</span>
                  <span>· {f.nickname || '(닉네임 없음)'}</span>
                  <span>· {FEEDBACK_SOURCE_LABELS[f.source] ?? f.source}</span>
                  {f.page_path && <code className="break-all text-neutral-500">{f.page_path}</code>}
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-neutral-800">
                  {f.body}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
