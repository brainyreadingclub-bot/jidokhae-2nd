import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth'
import { getProfile } from '@/lib/profile'
import { getKSTToday, getDaysUntil } from '@/lib/kst'
import { listAppNotifications } from '@/lib/app-notifications'
import { getTopicsWithStats } from '@/lib/discussion'
import { isDiscussionApplyOpen, canWriteAnswer } from '@/lib/discussion-rules'
import HomeView, { type HomeData } from '@/components/next/HomeView'
import WhatsNewSheet from '@/components/next/WhatsNewSheet'
import { isCurator } from '@/lib/curator'
import type { Meeting } from '@/types/meeting'

/** 자리를 차지하고 있는(= 새로 신청할 수 없는) status */
const LIVE_REG_STATUSES: string[] = ['confirmed', 'pending_transfer', 'waitlisted']

export default async function NextHomePage() {
  const user = await getUser()
  const profile = user ? await getProfile(user.id) : null
  const nickname = profile?.nickname || '회원'
  const kstToday = getKSTToday()
  const supabase = await createClient()

  // 다가오는 모임 전체 (정기+토론) — 토론 홍보 카드용 책 표지 join
  const { data: meetings } = await supabase
    .from('meetings')
    .select('*, books(thumbnail, authors)')
    .eq('status', 'active')
    .gte('date', kstToday)
    .order('date', { ascending: true })
    .order('time', { ascending: true })
  const upcoming = (meetings ?? []) as (Meeting & {
    books: { thumbnail: string | null; authors: string | null } | null
  })[]

  // 내 신청 — 쿼리는 그대로 1건이고 **범위만** 넓혔다.
  // 옛 쿼리는 다가오는 모임 + 살아 있는 status만 읽었는데, 「신청 이력 0건」(2026-09-19 A3)은
  // 지난 모임과 취소 건까지 세야 한다 — "취소했어도 신청은 한 것"(2026-08-26 북극성 정의).
  // status 필터를 JS로 옮긴 이유: 취소 행이 Map에서 확정 행을 덮어쓰면 안 되기 때문
  // (재신청은 새 행을 만들어서 한 모임에 여러 행이 생길 수 있다).
  const meetingIds = upcoming.map((m) => m.id)
  const { data: myRegs } = user && meetingIds.length > 0
    ? await supabase
        .from('registrations')
        .select('meeting_id, status')
        .eq('user_id', user.id)
    : { data: [] as { meeting_id: string; status: string }[] }
  const allRegs = myRegs ?? []
  // waitlisted 포함 (홍보 카드에서 대기자에게 "신청하세요" 노출 방지)
  const myRegMap = new Map(
    allRegs
      .filter((r) => LIVE_REG_STATUSES.includes(r.status))
      .map((r) => [r.meeting_id, r.status])
  )
  /** 한 번도 신청한 적 없는 회원 — 모임이 있을 때만 의미가 있어 그때만 판정한다 */
  const firstTime = Boolean(user) && meetingIds.length > 0 && allRegs.length === 0

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

  // ② 내가 신청한 다음 모임 — 확정·입금대기만 (waitlisted는 자리 확정이 아니라 제외)
  const mine = upcoming.find((m) => {
    const s = myRegMap.get(m.id)
    return s === 'confirmed' || s === 'pending_transfer'
  })
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

  // ③ 가장 가까운 모임 — 신청 이력 0건 회원에게만 1건 (2026-09-19 A3, ㉮안).
  //    쿼리를 더 치지 않는다. 위에서 이미 불러온 upcoming에서 고르는 것뿐이다.
  let nearest: HomeData['nearest'] = null
  if (firstTime) {
    const myRegions = profile?.region ?? []
    // upcoming은 date·time 오름차순 — 지역이 겹치는 첫 건, 없으면 날짜순 첫 건
    const regular = upcoming.filter((m) => m.meeting_type !== 'discussion')
    const pick = regular.find((m) => myRegions.includes(m.region)) ?? regular[0]
    if (pick) {
      nearest = {
        id: pick.id,
        title: pick.title,
        date: pick.date,
        time: pick.time,
        venueName: pick.location ?? '',
        fee: pick.fee,
      }
    }
  }

  // ④ 토론 홍보 — 미신청 + (열림이거나 마감 후 문구 전환)
  const discussion = upcoming.find((m) => m.meeting_type === 'discussion')
  const promo: HomeData['promo'] =
    discussion && !myRegMap.has(discussion.id)
      ? {
          meetingId: discussion.id,
          title: discussion.title,
          date: discussion.date,
          time: discussion.time,
          venueName: discussion.location ?? '',
          open: isDiscussionApplyOpen(discussion.date, kstToday),
          // 신청 이력 0건 = 정기 1회 이상(2026-08-22)을 채웠을 수 없다. 큐레이터는 우회 통과라 제외.
          // ⚠️ 자격 판정 본체(A4)는 아직 없다 — 확실히 미자격인 집합에만 라벨을 붙인다.
          locked: firstTime && !(profile && isCurator(profile)),
          thumbnail: discussion.books?.thumbnail ?? null,
          authors: discussion.books?.authors ?? null,
        }
      : null

  // ⑤ 답 안 한 발제 — 신청한 토론이 있을 때
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
      <HomeView data={{ nickname, reply, nextMeeting, nearest, promo, todo }} />
    </>
  )
}
