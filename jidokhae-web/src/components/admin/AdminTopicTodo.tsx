import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getDaysUntil } from '@/lib/kst'
import { getTopicCountsForAdmin } from '@/lib/discussion'
import { NO_TOPICS, needsTopicAction, topicStatusLabel } from '@/lib/topic-status'

/**
 * 운영자 첫 화면 「발제문」 할 일 줄 (2026-10-09 시안 A).
 * 다가오는 토론모임 중 「발제문 없음」 또는 「작성 중 ≥1」인 모임만 한 줄씩.
 * 전부 공개된 모임은 처리할 일이 없어서 띄우지 않는다.
 * 기존 「긴급」 줄과 같은 문법(태그 + 내용 + 오른쪽 행동), 색은 중립.
 */
export default async function AdminTopicTodo({ kstToday }: { kstToday: string }) {
  const supabase = await createClient()
  const { data: meetings } = await supabase
    .from('meetings')
    .select('id, title, date')
    .eq('status', 'active')
    .eq('meeting_type', 'discussion')
    .gte('date', kstToday)
    .order('date', { ascending: true })
  const rows = (meetings ?? []) as { id: string; title: string; date: string }[]
  if (rows.length === 0) return null

  const ids = rows.map((m) => m.id)
  const [counts, { data: confirmed }] = await Promise.all([
    getTopicCountsForAdmin(ids),
    supabase.rpc('get_confirmed_counts', { meeting_ids: ids }),
  ])
  const applicants = new Map(
    ((confirmed ?? []) as { meeting_id: string; confirmed_count: number }[]).map((c) => [
      c.meeting_id,
      Number(c.confirmed_count),
    ]),
  )

  const todo = rows
    .map((m) => ({ ...m, c: counts.get(m.id) ?? NO_TOPICS }))
    .filter((m) => needsTopicAction(m.c))
  if (todo.length === 0) return null

  return (
    <div className="mb-6 space-y-2">
      {todo.map((m) => {
        const empty = m.c.draft === 0 && m.c.published === 0
        return (
          <Link
            key={m.id}
            href={`/admin/meetings/${m.id}/topics`}
            className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 rounded-[var(--radius-md)] bg-white px-4 py-3 transition-colors hover:bg-surface-100 lg:flex-nowrap"
            style={{ border: '1px solid var(--color-surface-300)' }}
          >
            <span className="flex-none text-[11px] font-extrabold tracking-wider text-primary-600">
              발제문
            </span>
            <span className="order-2 flex min-w-0 basis-full flex-col gap-0.5 lg:order-none lg:flex-1 lg:basis-auto lg:flex-row lg:items-baseline lg:gap-2.5">
              <span className="flex-none text-[13px] font-bold text-neutral-800">
                {shortDate(m.date)}
              </span>
              <span className="min-w-0 text-sm font-semibold text-neutral-900 lg:truncate">
                {m.title}
              </span>
              <span className="flex-none whitespace-nowrap text-xs text-neutral-600">
                · 신청 {applicants.get(m.id) ?? 0}명 · 모임까지 {getDaysUntil(m.date, kstToday)}일
              </span>
            </span>
            <span className="order-3 flex-1 whitespace-nowrap text-sm font-extrabold text-neutral-900 lg:order-none lg:flex-none">
              {topicStatusLabel(m.c)}
            </span>
            <span className="order-4 inline-flex h-8 flex-none items-center rounded-[9px] bg-primary-600 px-3 text-xs font-bold text-white lg:order-none">
              {empty ? '등록하기' : '이어서 하기'}
            </span>
          </Link>
        )
      })}
    </div>
  )
}

/** "2026-10-27" → "10/27 (화)" */
function shortDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dow = ['일', '월', '화', '수', '목', '금', '토'][new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  return `${m}/${d} (${dow})`
}
