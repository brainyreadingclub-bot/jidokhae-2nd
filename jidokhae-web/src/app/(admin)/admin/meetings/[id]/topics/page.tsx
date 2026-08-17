import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/admin'
import TopicsManager from '@/components/admin/TopicsManager'
import type { DiscussionTopic } from '@/types/discussion'
import type { Meeting } from '@/types/meeting'

/**
 * 발제문 관리 (admin·editor — (admin) 레이아웃이 역할 검사).
 * 스텝(is_staff)의 진입은 2단계에서 별도 경로로 — API는 이미 큐레이터를 허용한다.
 */
export default async function AdminTopicsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const admin = createServiceClient()

  const { data: meeting } = await admin
    .from('meetings')
    .select('id, title, date, meeting_type')
    .eq('id', id)
    .single()
  if (!meeting) notFound()
  const m = meeting as Pick<Meeting, 'id' | 'title' | 'date' | 'meeting_type'>

  const { data: topics } = await admin
    .from('discussion_topics')
    .select('*')
    .eq('meeting_id', id)
    .order('topic_no')

  return (
    <div>
      <div className="mb-4">
        <Link href={`/admin/meetings/${id}`} className="text-sm text-neutral-500">
          ← 모임 상세
        </Link>
        <h1 className="mt-2 text-lg font-bold">발제문 관리</h1>
        <p className="mt-1 text-sm text-neutral-600">
          {m.title} · {m.date}
        </p>
        {m.meeting_type !== 'discussion' && (
          <p className="mt-2 rounded-lg bg-accent-500/10 px-3 py-2 text-xs font-semibold text-accent-500">
            정기모임입니다 — 발제문은 토론모임에서만 회원에게 보여요
          </p>
        )}
      </div>
      <TopicsManager meetingId={id} topics={(topics ?? []) as DiscussionTopic[]} />
    </div>
  )
}
