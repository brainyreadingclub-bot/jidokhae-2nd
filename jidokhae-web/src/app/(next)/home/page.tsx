import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth'
import { getProfile } from '@/lib/profile'
import { getKSTToday, getDaysUntil } from '@/lib/kst'
import { listAppNotifications } from '@/lib/app-notifications'
import { getTopicsWithStats } from '@/lib/discussion'
import { isDiscussionApplyOpen, canWriteAnswer } from '@/lib/discussion-rules'
import HomeView, { type HomeData } from '@/components/next/HomeView'
import WhatsNewSheet from '@/components/next/WhatsNewSheet'
import type { Meeting } from '@/types/meeting'

export default async function NextHomePage() {
  const user = await getUser()
  const profile = user ? await getProfile(user.id) : null
  const nickname = profile?.nickname ?? '회원'
  const kstToday = getKSTToday()
  const supabase = await createClient()

  // 다가오는 모임 전체 (정기+토론)
  const { data: meetings } = await supabase
    .from('meetings')
    .select('*')
    .eq('status', 'active')
    .gte('date', kstToday)
    .order('date', { ascending: true })
    .order('time', { ascending: true })
  const upcoming = (meetings ?? []) as Meeting[]

  // 내 신청 (confirmed·pending_transfer)
  const meetingIds = upcoming.map((m) => m.id)
  const { data: myRegs } = user && meetingIds.length > 0
    ? await supabase
        .from('registrations')
        .select('meeting_id, status')
        .eq('user_id', user.id)
        .in('status', ['confirmed', 'pending_transfer'])
        .in('meeting_id', meetingIds)
    : { data: [] as { meeting_id: string; status: string }[] }
  const myRegMap = new Map((myRegs ?? []).map((r) => [r.meeting_id, r.status]))

  // ① 반응 — 최신 미읽음 답글 알림 1건
  let reply: HomeData['reply'] = null
  if (user) {
    const notis = await listAppNotifications(user.id, 10)
    const found = notis.find((n) => n.type === 'answer_reply' && n.read_at === null)
    if (found) {
      reply = {
        actorNickname: String(found.payload.actor_nickname ?? '회원'),
        preview: String(found.payload.preview ?? ''),
        topicId: String(found.payload.topic_id ?? ''),
      }
    }
  }

  // ② 내가 신청한 다음 모임
  const mine = upcoming.find((m) => myRegMap.has(m.id))
  const nextMeeting: HomeData['nextMeeting'] = mine
    ? {
        id: mine.id,
        title: mine.title,
        date: mine.date,
        time: mine.time,
        venueName: mine.location ?? '',
        daysLeft: getDaysUntil(mine.date, kstToday),
        pendingTransfer: myRegMap.get(mine.id) === 'pending_transfer',
      }
    : null

  // ③ 토론 홍보 — 미신청 + (열림이거나 마감 후 문구 전환)
  const discussion = upcoming.find((m) => m.meeting_type === 'discussion')
  const promo: HomeData['promo'] =
    discussion && !myRegMap.has(discussion.id)
      ? {
          meetingId: discussion.id,
          title: discussion.title,
          date: discussion.date,
          venueName: discussion.location ?? '',
          open: isDiscussionApplyOpen(discussion.date, kstToday),
        }
      : null

  // ④ 답 안 한 발제 — 신청한 토론이 있을 때
  let todo: HomeData['todo'] = null
  if (user && discussion && canWriteAnswer(myRegMap.get(discussion.id) ?? null)) {
    const topics = await getTopicsWithStats(discussion.id, user.id)
    if (topics.length > 0) {
      const unanswered = topics.filter((t) => !t.my_answered).length
      const answeredSomeone = topics.filter((t) => t.answer_count > 0).length
      todo = {
        meetingId: discussion.id,
        unanswered,
        answeredLine: `발제 ${topics.length}개 중 ${answeredSomeone}개에 답이 달렸어요`,
      }
    }
  }

  return (
    <>
      <WhatsNewSheet />
      <HomeView data={{ nickname, reply, nextMeeting, promo, todo }} />
    </>
  )
}
