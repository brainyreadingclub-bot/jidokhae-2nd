import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth'
import { getProfile } from '@/lib/profile'
import { getKSTToday, getDaysUntil, getButtonState } from '@/lib/kst'
import { listAppNotifications } from '@/lib/app-notifications'
import { getTopicsWithStats } from '@/lib/discussion'
import { isDiscussionApplyOpen, canWriteAnswer } from '@/lib/discussion-rules'
import { isDiscussionMeetingEnabled, canApplyToDiscussion } from '@/lib/discussion-gate'
import { getSeatStatus, resolveSeatThresholds } from '@/lib/seat-status'
import { getSiteSettings } from '@/lib/site-settings'
import { pickUpcomingRegulars, toUpcomingAction } from '@/lib/home-upcoming'
import { PARTICIPATED_STATUSES } from '@/lib/registration-status'
import HomeView, { type HomeData } from '@/components/next/HomeView'
import WhatsNewSheet from '@/components/next/WhatsNewSheet'
import type { Meeting } from '@/types/meeting'

/** 자리를 차지하고 있는(= 새로 신청할 수 없는) status */
const LIVE_REG_STATUSES: string[] = ['confirmed', 'pending_transfer', 'waitlisted']

export default async function NextHomePage() {
  const user = await getUser()
  const kstToday = getKSTToday()
  const supabase = await createClient()

  // 프로필·다가오는 모임·내 신청·알림은 서로 무관하다 — 동시에 받는다 (2026-10-13 속도 점검).
  // 차례로 기다리면 홈 본문이 DB를 네 번 연달아 기다렸다
  const [profile, meetingsRes, myRegsRes, notis] = await Promise.all([
    user ? getProfile(user.id) : null,
    // 다가오는 모임 전체 (정기+토론) — 토론 홍보 카드용 책 표지 join
    supabase
      .from('meetings')
      .select('*, books(thumbnail, authors)')
      .eq('status', 'active')
      .gte('date', kstToday)
      .order('date', { ascending: true })
      .order('time', { ascending: true }),
    // 내 신청 — 범위는 아래 주석 참조
    user
      ? supabase
          .from('registrations')
          // meetings join — 「정기모임에 확정된 적 있는 지역」(⑥ 다가오는 정기모임 정렬)용
          .select('meeting_id, status, meetings(region, meeting_type)')
          .eq('user_id', user.id)
      : Promise.resolve({ data: [], error: null }),
    user ? listAppNotifications(user.id, 10) : [],
  ])
  // 조회 실패를 빈 값으로 삼키면 진짜 0건과 구분이 안 된다 — 모임 탭·이야기 탭과 같은 방식으로
  // 던져서 (next)/error.tsx의 「화면을 불러오지 못했어요 · 다시 시도」로 보낸다 (2026-10-14 대표님 결정).
  // 모임이 틀리면 「지금은 조용해요」가, 내 신청이 틀리면 이미 신청한 모임이 「다가오는 정기모임」에 뜬다
  if (meetingsRes.error) throw new Error(`홈 모임 조회 실패: ${meetingsRes.error.message}`)
  if (myRegsRes.error) throw new Error(`홈 내 신청 조회 실패: ${myRegsRes.error.message}`)
  const meetings = meetingsRes.data
  const myRegs = myRegsRes.data
  const nickname = profile?.nickname || '회원'
  const upcoming = (meetings ?? []) as (Meeting & {
    books: { thumbnail: string | null; authors: string | null } | null
  })[]

  // 내 신청 — 쿼리는 그대로 1건이고 **범위만** 넓혔다.
  // 옛 쿼리는 다가오는 모임 + 살아 있는 status만 읽었는데, 「신청 이력 0건」(2026-09-19 A3)은
  // 지난 모임과 취소 건까지 세야 한다 — "취소했어도 신청은 한 것"(2026-08-26 북극성 정의).
  // status 필터를 JS로 옮긴 이유: 취소 행이 Map에서 확정 행을 덮어쓰면 안 되기 때문
  // (재신청은 새 행을 만들어서 한 모임에 여러 행이 생길 수 있다).
  // (다가오는 모임이 없으면 신청 이력은 쓰지 않는다 — 옛 코드는 그때 조회 자체를 건너뛰었다)
  const meetingIds = upcoming.map((m) => m.id)
  type MyReg = {
    meeting_id: string
    status: string
    meetings: { region: string | null; meeting_type: string | null } | null
  }
  const allRegs = meetingIds.length > 0 ? ((myRegs ?? []) as unknown as MyReg[]) : []
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

  // ③ 가장 가까운 모임 — **내가 신청한 다가오는 모임이 없을 때** 1건 (2026-09-19 A3, ㉮안).
  //    게이트가 `firstTime`에서 `!mine`으로 넓어졌다 — 신청 이력은 있지만 지금 신청한 모임이
  //    없는 기존 회원이 홈에서 「지금은 조용해요」만 보고 있었다. 켜는 날 대부분이 이 상태다.
  //    인사 문구는 이 카드를 따라가지 않는다 — 그쪽은 `firstTime`이 가른다 (HomeView 참조).
  //    쿼리를 더 치지 않는다. 위에서 이미 불러온 upcoming에서 고르는 것뿐이다.
  // ⑥ 다가오는 정기모임 최대 3건 (2026-10-13 시안) — 「가장 가까운 모임」 1건을 대신한다.
  //    회원 권한(anon + RLS) 클라이언트로 읽은 upcoming에서 고른다 — 쿼리 1건(인원 수)만 추가.
  //    내가 신청한 모임(confirmed·pending_transfer·waitlisted = 취소 제외)은 뺀다.
  //    마감된 모임도 보여 준다 — 2차 수정의 「마감 제외」를 되돌렸다 (2026-10-15 대표님 확인).
  //    정원이 찬 경주 10/21 모임이 칸에서 사라졌었다. 칸의 버튼 표시는 모임 상세와 같은 판정(getButtonState)
  const regularCandidates = upcoming.filter(
    (m) => m.meeting_type === 'regular' && !myRegMap.has(m.id),
  )
  const discussion = upcoming.find((m) => m.meeting_type === 'discussion')
  // 인원 수(⑥)와 토론 격리 플래그(④)는 서로 무관하다 — 동시에 받는다 (속도 점검의 원칙 유지).
  // 격리 플래그 OFF면 홍보를 내린다 — "새로 들어오는 것만 막는다"의 홈 쪽 몫.
  // ② 내 모임 스트립은 플래그와 무관하게 위에서 그대로 렌더된다(결제한 모임은 안 숨긴다)
  const [countsRes, discussionEnabled] = await Promise.all([
    regularCandidates.length > 0
      ? supabase.rpc('get_confirmed_counts', {
          meeting_ids: regularCandidates.map((m) => m.id),
        })
      : Promise.resolve({ data: [], error: null }),
    discussion ? isDiscussionMeetingEnabled() : false,
  ])
  // 인원 수가 틀리면 마감된 모임이 「다가오는 정기모임」에 신청할 수 있는 것처럼 뜬다 — 이것도 삼키지 않는다
  // (모임 탭이 같은 조회 실패를 오류 화면으로 보낸다)
  if (countsRes.error) throw new Error(`홈 참가자 수 조회 실패: ${countsRes.error.message}`)
  const counts = countsRes.data
  const countMap = new Map(
    ((counts ?? []) as { meeting_id: string; confirmed_count: number }[]).map((c) => [
      c.meeting_id,
      Number(c.confirmed_count),
    ]),
  )
  // 정기모임에 확정된 적 있는 지역 — 그 지역 모임을 먼저 채운다 (pending_transfer = confirmed 동등)
  const homeRegions = new Set(
    allRegs
      .filter(
        (r) =>
          (PARTICIPATED_STATUSES as readonly string[]).includes(r.status) &&
          r.meetings?.meeting_type === 'regular' &&
          r.meetings.region,
      )
      .map((r) => r.meetings!.region as string),
  )
  const regularPicks = pickUpcomingRegulars(regularCandidates, homeRegions)
  // 실서비스에선 레이아웃의 플래그 조회(next_ui)와 같은 요청이라 cache()가 그대로 돌려준다 — 조회가 늘지 않는다
  const seatThresholds = resolveSeatThresholds(await getSiteSettings())
  const upcomingRegular: HomeData['upcoming'] = regularPicks.map((m) => {
    const count = countMap.get(m.id) ?? 0
    // 자리 상태 공통 규칙(seat-status.ts) — 「n자리 남았어요」일 때만 말한다. 3명 미만 가리기도 그 안에서 지킨다
    const seatsLeft = getSeatStatus({
      capacity: m.capacity,
      confirmed: count,
      isPrivileged: false,
      thresholds: seatThresholds,
    }).seatsLeft
    return {
      id: m.id,
      date: m.date,
      time: m.time,
      region: m.region ?? '',
      venueName: m.location ?? '',
      seatsLeft,
      // 모임 상세와 같은 판정 — 후보는 내가 신청 안 한 모임만이라 본인 신청 여부는 전부 false.
      // 정원 판정도 상세와 같다(confirmed + pending_transfer 수 ≥ 정원 → 대기 신청)
      action: toUpcomingAction(getButtonState(m.date, kstToday, false, count >= m.capacity)),
    }
  })

  let nearest: HomeData['nearest'] = null
  if (!mine && upcomingRegular.length === 0) {
    const myRegions = profile?.region ?? []
    // upcoming은 date·time 오름차순 — 지역이 겹치는 첫 건, 없으면 날짜순 첫 건.
    // 대기 중인 모임은 뺀다 — 이미 줄을 선 모임을 「가장 가까운 모임」으로 다시 권유하지
    // 않는다. `mine`은 confirmed·pending_transfer만 세지만 `myRegMap`은 waitlisted까지
    // 담고 있어, 이 한 줄이 대기 건을 덮는다
    // 정기만 — 작업실·별책부록을 「가장 가까운 정기 자리」로 권유하지 않는다(기타 모임 틀 §2)
    const regular = upcoming.filter(
      (m) => m.meeting_type === 'regular' && !myRegMap.has(m.id),
    )
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

  // ④ 토론 홍보 — 미신청일 때. 「신청 열림」은 정기모임과 같은 기준(모임 당일까지) — D-7 마감 폐지(2026-10-13)
  // (discussion · discussionEnabled는 위 ⑥에서 인원 수와 함께 받았다)

  // 자격 판정 본체가 들어왔다 — `firstTime` 어림짐작을 실제 판정으로 바꾼다.
  // 카드를 숨기지는 않는다(블라인드 금지). 라벨만 바뀌고, CTA는 「발제문 먼저 읽어보기」라
  // 자격이 없어도 할 수 있는 일을 가리킨다
  //
  // 자격 판정(홍보 카드용)과 발제 목록(⑤ 할 일용)은 서로 무관하다 — 동시에 받는다.
  // 자격 판정은 홍보 카드가 뜰 때(미신청)만 한다 — 이미 신청한 회원에겐 결과를 버리고 있었다
  const showPromo = !!discussion && discussionEnabled && !myRegMap.has(discussion.id)
  const wantsTodo =
    !!user && !!discussion && canWriteAnswer(myRegMap.get(discussion.id) ?? null)
  const [promoLocked, todoTopics] = await Promise.all([
    showPromo && user ? canApplyToDiscussion(user.id).then((ok) => !ok) : false,
    wantsTodo ? getTopicsWithStats(discussion!.id, user!.id) : [],
  ])

  const promo: HomeData['promo'] =
    discussion && showPromo
      ? {
          meetingId: discussion.id,
          title: discussion.title,
          date: discussion.date,
          time: discussion.time,
          venueName: discussion.location ?? '',
          open: isDiscussionApplyOpen(discussion.date, kstToday),
          locked: promoLocked,
          thumbnail: discussion.books?.thumbnail ?? null,
          authors: discussion.books?.authors ?? null,
        }
      : null

  // ⑤ 답 안 한 발제 — 신청한 토론이 있을 때
  let todo: HomeData['todo'] = null
  if (discussion && wantsTodo) {
    const topics = todoTopics
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
      <HomeView data={{ nickname, firstTime, reply, nextMeeting, nearest, upcoming: upcomingRegular, promo, todo }} />
    </>
  )
}
