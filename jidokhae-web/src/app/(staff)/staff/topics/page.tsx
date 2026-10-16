import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/admin'
import { getKSTToday, getDaysUntil, formatKoreanDate } from '@/lib/kst'
import { getTopicCountsForAdmin } from '@/lib/discussion'
import { NO_TOPICS, topicStatusLabel, type TopicCounts } from '@/lib/topic-status'

/**
 * 스텝 구역 첫 화면 — 다가오는 토론모임 목록. 줄을 누르면 그 모임의 발제문으로.
 * 신청자 명단·인원은 보여 주지 않는다 — 스텝에게 열린 것은 발제문뿐이다(2026-10-16)
 */
export default async function StaffTopicsHome() {
  const kstToday = getKSTToday()
  const admin = createServiceClient()
  const { data } = await admin
    .from('meetings')
    .select('id, title, date, region')
    .eq('status', 'active')
    .eq('meeting_type', 'discussion')
    .gte('date', kstToday)
    .order('date', { ascending: true })
  const rows = (data ?? []) as { id: string; title: string; date: string; region: string | null }[]
  const counts = rows.length > 0 ? await getTopicCountsForAdmin(rows.map((m) => m.id)) : new Map<string, TopicCounts>()

  return (
    <div>
      <h1
        className="text-2xl font-extrabold tracking-tight text-primary-900 lg:text-3xl"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        발제문
      </h1>
      <p className="mt-1.5 text-sm text-primary-600 break-keep">다가오는 토론모임의 발제문을 쓰고 공개해요</p>

      {rows.length === 0 ? (
        <p className="mt-8 text-sm text-neutral-500">다가오는 토론모임이 없어요</p>
      ) : (
        <div className="mt-6 space-y-2">
          {rows.map((m) => {
            const c = counts.get(m.id) ?? NO_TOPICS
            const days = getDaysUntil(m.date, kstToday)
            return (
              <Link
                key={m.id}
                href={`/staff/topics/${m.id}`}
                className="flex items-center gap-3 rounded-[var(--radius-md)] bg-white px-4 py-3 transition-colors hover:bg-surface-100"
                style={{ border: '1px solid var(--color-surface-300)' }}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-bold text-neutral-800">
                    {formatKoreanDate(m.date)}
                    {m.region ? ` · ${m.region}` : ''}
                    <span className="ml-2 font-semibold text-neutral-500">{days === 0 ? '오늘' : `D-${days}`}</span>
                  </span>
                  <span className="block truncate text-sm font-semibold text-neutral-900">{m.title}</span>
                </span>
                <span className="flex-none text-xs font-semibold text-primary-600">{topicStatusLabel(c)}</span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
