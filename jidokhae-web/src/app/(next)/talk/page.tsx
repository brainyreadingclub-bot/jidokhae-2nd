import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/admin'
import { getUser } from '@/lib/auth'
import { getKSTToday } from '@/lib/kst'
import { getTopicsAndAnswers, withTopicStats } from '@/lib/discussion'
import { isDiscussionApplyOpen, canWriteAnswer } from '@/lib/discussion-rules'
import { isDiscussionMeetingEnabled, canApplyToDiscussion } from '@/lib/discussion-gate'
import TalkView, { type TalkData } from '@/components/next/TalkView'
import type { Meeting } from '@/types/meeting'

type UpcomingRow = Meeting & { books: { thumbnail: string | null; authors: string | null } | null }
type PastRow = { id: string; title: string; date: string; books: { thumbnail: string | null } | null }

export default async function NextTalkPage() {
  const user = await getUser()
  const kstToday = getKSTToday()
  const supabase = await createClient()

  // 다가오는 토론 1건 + 지난 토론 6건 (책 표지 join)
  const [upcomingRes, pastRes] = await Promise.all([
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
  // 조회 실패를 빈 목록으로 삼키면 「아직 토론모임이 없어요」처럼 보인다 — 오류 화면으로 보낸다
  if (upcomingRes.error) throw new Error(`다가오는 토론 조회 실패: ${upcomingRes.error.message}`)
  if (pastRes.error) throw new Error(`지난 토론 조회 실패: ${pastRes.error.message}`)

  const d = (upcomingRes.data ?? [])[0] as UpcomingRow | undefined
  const pastMeetings = (pastRes.data ?? []) as unknown as PastRow[]

  // 다가오는 토론 블록과 지난 토론 블록은 서로 무관하다 — 동시에 받는다 (2026-10-13 속도 점검).
  // 지난 토론을 숨길지(hideDiscussion)는 다 받은 뒤에 가른다
  const [upcoming, pastAll, discussionEnabled] = await Promise.all([
    d ? loadUpcoming(d, user?.id ?? null, kstToday) : null,
    loadPast(pastMeetings),
    isDiscussionMeetingEnabled(),
  ])

  let discussion: TalkData['discussion'] = upcoming?.discussion ?? null
  let topics: TalkData['topics'] = upcoming?.topics ?? []

  // 격리 플래그 OFF — 미참여자에게 이야기 탭을 빈 상태로 둔다(목록 노출 차단).
  // 🔴 이미 신청한 사람(confirmed·pending_transfer)과 대기자에게는 그대로 보인다.
  //    자기가 쓴 답변이 없어진 것처럼 보이면 안 된다 — 데이터도 지우지 않는다.
  //    탭 자체는 남긴다(5탭 레이아웃이 흔들리지 않게)
  const isParticipant = discussion?.applied === true || discussion?.waitlisted === true
  const hideDiscussion = !discussionEnabled && !isParticipant
  if (hideDiscussion) {
    discussion = null
    topics = []
  }
  const past: TalkData['past'] = hideDiscussion ? [] : pastAll

  return <TalkView data={{ discussion, topics, past }} />
}

/** 다가오는 토론 — 발제·내 신청 상태·진행률(신청자 중 답변자 수 — 부담 노출) */
async function loadUpcoming(
  d: UpcomingRow,
  userId: string | null,
  kstToday: string,
): Promise<{ discussion: NonNullable<TalkData['discussion']>; topics: TalkData['topics'] }> {
  const admin = createServiceClient()
  // 발제(+답변)와 신청 현황은 서로 무관하다 — 동시에
  const [{ topics: topicRows, answers }, { data: regs }, { data: wl }] = await Promise.all([
    getTopicsAndAnswers(d.id),
    admin
      .from('registrations')
      .select('user_id, status')
      .eq('meeting_id', d.id)
      .in('status', ['confirmed', 'pending_transfer']),
    // 대기 중인 본인에게 "신청하기" CTA를 다시 보여주지 않기 위한 별도 조회
    // (regs는 진행률 분모 유지를 위해 confirmed·pending_transfer만 조회)
    userId
      ? admin
          .from('registrations')
          .select('id')
          .eq('meeting_id', d.id)
          .eq('user_id', userId)
          .eq('status', 'waitlisted')
          .limit(1)
      : Promise.resolve({ data: [] as { id: string }[] }),
  ])
  const topics = withTopicStats(topicRows, answers, userId)

  const applicants = [...new Set((regs ?? []).map((r) => r.user_id))]
  const myStatus = userId
    ? ((regs ?? []).find((r) => r.user_id === userId)?.status ?? null)
    : null
  const waitlisted = myStatus === null && (wl ?? []).length > 0

  let progress: NonNullable<TalkData['discussion']>['progress'] = null
  if (topics.length > 0 && applicants.length > 0) {
    // 답변 행은 위에서 발제와 함께 읽었다 — 다시 조회하지 않는다
    const answered = new Set(
      answers.filter((a) => applicants.includes(a.user_id)).map((a) => a.user_id),
    ).size
    progress = {
      answered,
      total: applicants.length,
      mine: topics.filter((t) => t.my_answered).length,
      topicCount: topics.length,
    }
  }

  const applied = canWriteAnswer(myStatus)

  // 자격 미충족 — 신청 CTA 자리에 안내 + 정기모임으로 가는 길을 둔다.
  // 발제문 읽기는 자격과 무관하게 열려 있다(`canWriteAnswer`가 쓰기만 막는다) —
  // 그래서 "발제문은 지금도 읽을 수 있어요"는 약속이 아니라 사실이다
  const locked =
    !applied && !waitlisted && userId ? !(await canApplyToDiscussion(userId)) : false

  return {
    topics,
    discussion: {
      id: d.id,
      title: d.title,
      date: d.date,
      time: d.time,
      venueName: d.location,
      fee: d.fee,
      open: isDiscussionApplyOpen(d.date, kstToday),
      applied,
      waitlisted,
      locked,
      isToday: d.date === kstToday,
      thumbnail: d.books?.thumbnail ?? null,
      authors: d.books?.authors ?? null,
      progress,
    },
  }
}

/** 지난 토론 — 공동 기록: 순번(전체 히스토리 기준) + 참여·발제·답변 흔적 */
async function loadPast(pastMeetings: PastRow[]): Promise<TalkData['past']> {
  if (pastMeetings.length === 0) return []
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
      admin
        .from('discussion_topics')
        .select('id, meeting_id')
        .in('meeting_id', pastIds)
        .not('published_at', 'is', null),
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
  return pastMeetings.map((p, i) => ({
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
