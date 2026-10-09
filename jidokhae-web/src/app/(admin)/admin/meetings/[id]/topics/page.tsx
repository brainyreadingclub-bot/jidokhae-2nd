import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/admin'
import { formatKoreanDate, formatKSTDateTime } from '@/lib/kst'
import TopicsManager from '@/components/admin/TopicsManager'
import type { DiscussionTopic } from '@/types/discussion'
import type { Meeting } from '@/types/meeting'

/**
 * 발제문 관리 (admin·editor — (admin) 레이아웃이 역할 검사). 2026-10-09 시안 B.
 * 붙여넣기 → 번호별로 나눠 「작성 중」 저장 → 「공개하기」 한 번 → 신청자 알림 한 번.
 * 스텝(is_staff)의 진입은 2단계에서 별도 경로로 — API는 이미 큐레이터를 허용한다.
 * 🔒 작성 중 발제를 읽는 화면이다 — service_role로 전부 읽는다(회원 화면은 공개된 것만).
 */
export default async function AdminTopicsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const admin = createServiceClient()

  const [{ data: meeting }, { data: topics }, { data: counts }] = await Promise.all([
    admin
      .from('meetings')
      .select('id, title, date, time, region, meeting_type, status')
      .eq('id', id)
      .single(),
    admin.from('discussion_topics').select('*').eq('meeting_id', id).order('topic_no'),
    admin.rpc('get_confirmed_counts', { meeting_ids: [id] }),
  ])
  if (!meeting || (meeting as Meeting).status === 'deleted') notFound()
  const m = meeting as Pick<
    Meeting,
    'id' | 'title' | 'date' | 'time' | 'region' | 'meeting_type' | 'status'
  >
  const list = (topics ?? []) as DiscussionTopic[]
  const applicantCount = Number(
    ((counts ?? []) as { meeting_id: string; confirmed_count: number }[]).find(
      (c) => c.meeting_id === id,
    )?.confirmed_count ?? 0,
  )
  const lastPublished = list
    .map((t) => t.published_at)
    .filter((v): v is string => v !== null)
    .sort()
    .at(-1)

  const subline = `${m.title} · ${formatKoreanDate(m.date)} ${m.time.slice(0, 5)} · 신청 ${applicantCount}명`

  return (
    <div>
      <Link
        href={`/admin/meetings/${id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-primary-500 hover:text-primary-700"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        모임 상세로 돌아가기
      </Link>
      <div className="mb-2 flex items-center gap-1.5">
        {m.region && (
          <span className="rounded-full bg-primary-50 px-2.5 py-0.5 text-[11px] font-bold text-primary-700">
            {m.region}
          </span>
        )}
        <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-bold text-neutral-700">
          {m.meeting_type === 'discussion' ? '토론' : '정기'}
        </span>
      </div>
      <h1
        className="text-2xl font-extrabold tracking-tight text-primary-900 lg:text-3xl"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        발제문
      </h1>
      <p className="mt-1.5 truncate text-sm text-primary-600" title={subline}>
        {subline}
      </p>
      {m.meeting_type !== 'discussion' && (
        <p className="mt-3 rounded-lg bg-accent-500/10 px-3 py-2 text-xs font-semibold text-accent-500">
          정기모임입니다 — 발제문은 토론모임에서만 회원에게 보여요
        </p>
      )}
      <TopicsManager
        meetingId={id}
        meetingTitle={m.title}
        topics={list}
        applicantCount={applicantCount}
        lastPublishedLabel={lastPublished ? formatKSTDateTime(lastPublished) : null}
      />
    </div>
  )
}
