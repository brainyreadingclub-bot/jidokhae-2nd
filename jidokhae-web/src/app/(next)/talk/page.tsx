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

  // 다가오는 토론 1건 + 지난 토론 6건
  const [{ data: upcomingRows }, { data: pastRows }] = await Promise.all([
    supabase
      .from('meetings')
      .select('*')
      .eq('status', 'active')
      .eq('meeting_type', 'discussion')
      .gte('date', kstToday)
      .order('date', { ascending: true })
      .limit(1),
    supabase
      .from('meetings')
      .select('id, title, date')
      .eq('meeting_type', 'discussion')
      .lt('date', kstToday)
      .order('date', { ascending: false })
      .limit(6),
  ])

  const d = (upcomingRows ?? [])[0] as Meeting | undefined
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
      isToday: d.date === kstToday,
      progress,
    }
  }

  const past: TalkData['past'] = ((pastRows ?? []) as Pick<Meeting, 'id' | 'title' | 'date'>[]).map(
    (p) => ({
      id: p.id,
      title: p.title,
      monthLabel: `${Number(p.date.slice(5, 7))}월`,
    }),
  )

  return <TalkView data={{ discussion, topics, past }} />
}
