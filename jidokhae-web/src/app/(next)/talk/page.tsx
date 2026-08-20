import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/admin'
import { getUser } from '@/lib/auth'
import { getKSTToday } from '@/lib/kst'
import { getTopicsWithStats } from '@/lib/discussion'
import { isDiscussionApplyOpen, canWriteAnswer } from '@/lib/discussion-rules'
import TalkView, { type TalkData } from '@/components/next/TalkView'
import type { Meeting } from '@/types/meeting'

export default async function NextTalkPage() {
  const user = await getUser()
  const kstToday = getKSTToday()
  const supabase = await createClient()

  // 다가오는 토론 1건 + 지난 토론 6건 (책 표지 join)
  const [{ data: upcomingRows }, { data: pastRows }] = await Promise.all([
    supabase
      .from('meetings')
      .select('*, books(thumbnail, authors)')
      .eq('status', 'active')
      .eq('meeting_type', 'discussion')
      .gte('date', kstToday)
      .order('date', { ascending: true })
      .limit(1),
    supabase
      .from('meetings')
      .select('id, title, date, books(thumbnail)')
      .eq('meeting_type', 'discussion')
      .neq('status', 'deleted')
      .lt('date', kstToday)
      .order('date', { ascending: false })
      .limit(6),
  ])

  const d = (upcomingRows ?? [])[0] as
    | (Meeting & { books: { thumbnail: string | null; authors: string | null } | null })
    | undefined
  let discussion: TalkData['discussion'] = null
  let topics: TalkData['topics'] = []

  if (d) {
    topics = await getTopicsWithStats(d.id, user?.id ?? null)

    // 내 신청 상태 + 진행(신청자 중 답변자 수 — 부담 노출)
    const admin = createServiceClient()
    const { data: regs } = await admin
      .from('registrations')
      .select('user_id, status')
      .eq('meeting_id', d.id)
      .in('status', ['confirmed', 'pending_transfer'])
    const applicants = [...new Set((regs ?? []).map((r) => r.user_id))]
    const myStatus = user
      ? ((regs ?? []).find((r) => r.user_id === user.id)?.status ?? null)
      : null

    // 대기 중인 본인에게 "신청하기" CTA를 다시 보여주지 않기 위한 별도 조회
    // (regs는 진행률 분모 유지를 위해 confirmed·pending_transfer만 조회)
    let waitlisted = false
    if (user && myStatus === null) {
      const { data: wl } = await admin
        .from('registrations')
        .select('id')
        .eq('meeting_id', d.id)
        .eq('user_id', user.id)
        .eq('status', 'waitlisted')
        .limit(1)
      waitlisted = (wl ?? []).length > 0
    }

    let progress: NonNullable<TalkData['discussion']>['progress'] = null
    if (topics.length > 0 && applicants.length > 0) {
      const topicIds = topics.map((t) => t.id)
      const { data: answers } = await admin
        .from('topic_answers')
        .select('user_id, topic_id')
        .in('topic_id', topicIds)
      const answered = new Set(
        (answers ?? [])
          .filter((a) => applicants.includes(a.user_id))
          .map((a) => a.user_id),
      ).size
      progress = {
        answered,
        total: applicants.length,
        mine: topics.filter((t) => t.my_answered).length,
        topicCount: topics.length,
      }
    }

    discussion = {
      id: d.id,
      title: d.title,
      date: d.date,
      time: d.time,
      venueName: d.location,
      fee: d.fee,
      open: isDiscussionApplyOpen(d.date, kstToday),
      applied: canWriteAnswer(myStatus),
      waitlisted,
      isToday: d.date === kstToday,
      thumbnail: d.books?.thumbnail ?? null,
      authors: d.books?.authors ?? null,
      progress,
    }
  }

  // 지난 토론 — 공동 기록: 순번(전체 히스토리 기준) + 참여·발제·답변 흔적
  type PastRow = { id: string; title: string; date: string; books: { thumbnail: string | null } | null }
  const pastMeetings = (pastRows ?? []) as unknown as PastRow[]
  let past: TalkData['past'] = []

  if (pastMeetings.length > 0) {
    const admin = createServiceClient()
    const pastIds = pastMeetings.map((p) => p.id)

    const [{ count: totalPastCount }, { data: pastTopics }, { data: confirmedCounts }] =
      await Promise.all([
        // 가장 최신 지난 토론의 순번 = 그 날짜까지의 토론 총수
        admin
          .from('meetings')
          .select('id', { count: 'exact', head: true })
          .eq('meeting_type', 'discussion')
          .neq('status', 'deleted')
          .lte('date', pastMeetings[0].date),
        admin.from('discussion_topics').select('id, meeting_id').in('meeting_id', pastIds),
        admin.rpc('get_confirmed_counts', { meeting_ids: pastIds }),
      ])

    const topicIds = (pastTopics ?? []).map((t) => t.id)
    const { data: pastAnswers } =
      topicIds.length > 0
        ? await admin.from('topic_answers').select('id, topic_id').in('topic_id', topicIds)
        : { data: [] as { id: string; topic_id: string }[] }

    const topicMeetingMap = new Map((pastTopics ?? []).map((t) => [t.id, t.meeting_id]))
    const topicCountMap = new Map<string, number>()
    for (const t of pastTopics ?? []) {
      topicCountMap.set(t.meeting_id, (topicCountMap.get(t.meeting_id) ?? 0) + 1)
    }
    const answerCountMap = new Map<string, number>()
    for (const a of pastAnswers ?? []) {
      const mid = topicMeetingMap.get(a.topic_id)
      if (mid) answerCountMap.set(mid, (answerCountMap.get(mid) ?? 0) + 1)
    }
    const participantMap = new Map(
      ((confirmedCounts ?? []) as { meeting_id: string; confirmed_count: number }[]).map((c) => [
        c.meeting_id,
        c.confirmed_count,
      ]),
    )

    // pastMeetings는 최신순 — 최신 책의 순번에서 역순으로 부여
    const newestOrdinal = totalPastCount ?? pastMeetings.length
    past = pastMeetings.map((p, i) => ({
      id: p.id,
      title: p.title,
      monthLabel: `${Number(p.date.slice(5, 7))}월`,
      thumbnail: p.books?.thumbnail ?? null,
      ordinal: Math.max(1, newestOrdinal - i),
      participantCount: participantMap.get(p.id) ?? 0,
      topicCount: topicCountMap.get(p.id) ?? 0,
      answerCount: answerCountMap.get(p.id) ?? 0,
    }))
  }

  return <TalkView data={{ discussion, topics, past }} />
}
