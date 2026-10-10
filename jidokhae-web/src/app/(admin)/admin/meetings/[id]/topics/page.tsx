import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/admin'
import { formatKoreanDate, formatKSTDateTime, getKSTToday } from '@/lib/kst'
import { isLinkOpen, linkClosesAtLabel } from '@/lib/presenter-link'
import TopicsManager from '@/components/admin/TopicsManager'
import type { DiscussionTopic } from '@/types/discussion'
import type { Meeting } from '@/types/meeting'

/**
 * 발제문 관리 (admin·editor — (admin) 레이아웃이 역할 검사). 2026-10-10 시안 O1~O6.
 * 운영자가 하나씩 쓰면 바로 공개(1차) + 발제자 링크로 받은 「작성 중」을 골라 공개(2차).
 * 알림은 DB 예약 작업이 마지막 공개 10분 뒤 묶어서 한 번(migration-topics-notify.sql).
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
  // 발제별 답변 수 — 삭제 확인 시트가 「답변 N개도 함께 지워져요」를 실제 값으로 말한다
  const answerCounts: Record<string, number> = {}
  if (list.length > 0) {
    const { data: answers } = await admin
      .from('topic_answers')
      .select('topic_id')
      .in(
        'topic_id',
        list.map((t) => t.id),
      )
    for (const a of (answers ?? []) as { topic_id: string }[]) {
      answerCounts[a.topic_id] = (answerCounts[a.topic_id] ?? 0) + 1
    }
  }
  // 발제자 링크 — 표가 아직 없으면(SQL 실행 전) 오류를 삼키고 링크 칸만 감춘다
  let link: { token: string | null; open: boolean; closesLabel: string } | null = null
  if (m.meeting_type === 'discussion') {
    const { data: row, error: linkError } = await admin
      .from('topic_presenter_links')
      .select('token, closed_at')
      .eq('meeting_id', id)
      .maybeSingle()
    if (!linkError) {
      const open = isLinkOpen(row, m, getKSTToday())
      link = { token: open ? (row?.token ?? null) : null, open, closesLabel: linkClosesAtLabel(m.date) }
    }
  }
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
        <span className="lg:hidden">모임 상세</span>
        <span className="hidden lg:inline">모임 상세로 돌아가기</span>
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
        answerCounts={answerCounts}
        link={link}
        meetingDateLabel={formatKoreanDate(m.date)}
        applicantCount={applicantCount}
        lastPublishedLabel={lastPublished ? formatKSTDateTime(lastPublished) : null}
      />
    </div>
  )
}
