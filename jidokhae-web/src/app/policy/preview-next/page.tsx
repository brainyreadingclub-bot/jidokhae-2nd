import { notFound } from 'next/navigation'
import HomeView from '@/components/next/HomeView'
import MeetView from '@/components/next/MeetView'
import TalkView from '@/components/next/TalkView'
import TopicThread from '@/components/next/TopicThread'
import LiveMode from '@/components/next/LiveMode'
import NotificationList from '@/components/next/NotificationList'
import NextNav from '@/components/next/NextNav'
import type { DiscussionTopic, TopicWithStats, AnswerWithMeta } from '@/types/discussion'
import type { AppNotification } from '@/types/app-notification'

/**
 * [임시] next_ui 컴포넌트 로컬 검증용 — OAuth 게이트 밖(policy) + dev 전용.
 * 검증 끝나면 이 파일을 삭제한다 (feedback_gated_layout_temp_preview 패턴).
 */

const topic: DiscussionTopic = {
  id: 't1',
  meeting_id: 'm1',
  topic_no: 1,
  title: '사랑과 관념',
  quote: '사랑은 변할 수 있다. 그러나 사랑에 대한 관념은 그러기가 쉽지 않다.',
  quote_page: '289',
  question:
    '사랑에 관해 나만의 관념이 있었나요? 책에서 가장 와닿았던 사랑 관련 문장과 새롭게 발견한 나의 관념 혹은 떠오른 생각에 대해 나눠봐요.',
  author_id: 'u0',
  created_at: '2026-08-20T00:00:00Z',
  updated_at: '2026-08-20T00:00:00Z',
}

const topics: TopicWithStats[] = [
  { ...topic, answer_count: 4, my_answered: true },
  {
    ...topic,
    id: 't2',
    topic_no: 2,
    title: '도덕, 연애, 결혼 그리고 사랑',
    question: '사랑은 그저 사랑일 뿐일까요? 도덕과 제도 테두리 속에서 성숙을 더해가는 것일까요?',
    answer_count: 3,
    my_answered: true,
  },
  {
    ...topic,
    id: 't3',
    topic_no: 3,
    title: '사랑이 실종된 현대',
    question: '사랑은 힘을 잃은 것일까요? 아니면 너무 많은 허들을 두는 것일까요?',
    answer_count: 2,
    my_answered: false,
  },
  {
    ...topic,
    id: 't5',
    topic_no: 5,
    title: '사람이 사랑을 이기지 못한다',
    question: '사랑이 성숙해진 걸까요, 다루는 내가 성숙해진 걸까요?',
    answer_count: 0,
    my_answered: false,
  },
]

const answers: AnswerWithMeta[] = [
  {
    id: 'a1',
    topic_id: 't1',
    user_id: 'me',
    body: '사랑이 상태라고 생각했는데, 읽고 나니 사건에 가깝다는 생각이 들었어요. 유지하는 게 아니라 계속 일어나는 것.',
    pinned: false,
    created_at: '2026-08-21T00:00:00Z',
    updated_at: '2026-08-21T00:00:00Z',
    nickname: '초록고래',
    reaction_count: 3,
    reply_count: 2,
    my_reacted: false,
  },
  {
    id: 'a2',
    topic_id: 't1',
    user_id: 'u2',
    body: '"사건에 가깝다"는 말이 계속 남아요. 그럼 사랑이 끝난 게 아니라 사건이 안 일어난 것뿐일 수도 있겠네요.',
    pinned: true,
    created_at: '2026-08-22T00:00:00Z',
    updated_at: '2026-08-22T00:00:00Z',
    nickname: '파랑새',
    reaction_count: 4,
    reply_count: 2,
    my_reacted: true,
  },
  {
    id: 'a3',
    topic_id: 't1',
    user_id: 'u3',
    body: '저는 아직 못 만난 것 같아요. 이런 답도 괜찮을까요?',
    pinned: false,
    created_at: '2026-08-23T00:00:00Z',
    updated_at: '2026-08-23T00:00:00Z',
    nickname: '밤하늘',
    reaction_count: 6,
    reply_count: 1,
    my_reacted: false,
  },
]

const notifications: AppNotification[] = [
  {
    id: 'n1',
    user_id: 'me',
    type: 'answer_reply',
    payload: {
      actor_nickname: '파랑새',
      preview: '"사건에 가깝다"는 말이 계속 남아요. 그럼 사랑이 끝난 게…',
      topic_id: 't1',
    },
    read_at: null,
    created_at: new Date(Date.now() - 3600e3).toISOString(),
  },
  {
    id: 'n2',
    user_id: 'me',
    type: 'answer_reaction',
    payload: { actor_nickname: '밤하늘', total_count: 3, answer_id: 'a1' },
    read_at: null,
    created_at: new Date(Date.now() - 86400e3).toISOString(),
  },
  {
    id: 'n3',
    user_id: 'me',
    type: 'topic_posted',
    payload: { title: '사랑과 관념', topic_no: 1 },
    read_at: '2026-08-20T00:00:00Z',
    created_at: new Date(Date.now() - 5 * 86400e3).toISOString(),
  },
  {
    id: 'n4',
    user_id: 'me',
    type: 'registration_confirmed',
    payload: {},
    read_at: '2026-08-19T00:00:00Z',
    created_at: new Date(Date.now() - 7 * 86400e3).toISOString(),
  },
]

function Shot({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section data-shot={label} className="mx-auto mb-10 w-[390px]">
      <p className="mb-2 text-xs font-bold text-neutral-400">{label}</p>
      <div className="relative min-h-[700px] overflow-hidden rounded-2xl bg-white pb-20 shadow-lg">
        <header className="flex h-12 items-center justify-between pl-5 pr-4">
          <span className="text-[17px] font-extrabold tracking-tight text-brand-deep">지독해</span>
          <span className="relative text-tg-700">🔔<i className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full border-2 border-white bg-warnx" /></span>
        </header>
        <main className="px-5">{children}</main>
        <div className="absolute inset-x-0 bottom-0"><NextNav /></div>
      </div>
    </section>
  )
}

export default function PreviewNextPage() {
  if (process.env.NODE_ENV !== 'development') notFound()

  return (
    <div className="bg-neutral-100 py-8">
      <Shot label="① 홈 — 반응 있음">
        <HomeView
          data={{
            nickname: '초록고래',
            reply: {
              actorNickname: '파랑새',
              preview: '"사건에 가깝다"는 말이 계속 남아요. 그럼 사랑이 끝난 게 아니라 사건이 안 일어난 것뿐일 수도…',
              topicId: 't1',
            },
            nextMeeting: {
              id: 'm0',
              title: '매주 수요일 정기모임',
              date: '2026-08-20',
              time: '19:30',
              venueName: '우연히 책방',
              daysLeft: 3,
              pendingTransfer: false,
            },
            promo: {
              meetingId: 'm1',
              title: '사랑의 생애',
              date: '2026-09-13',
              venueName: '우연히 책방',
              open: true,
            },
            todo: { meetingId: 'm1', unanswered: 2, answeredLine: '발제 4개 중 3개에 답이 달렸어요' },
          }}
        />
      </Shot>

      <Shot label="② 홈 — 전부 빈 상태">
        <HomeView
          data={{ nickname: '달빛', reply: null, nextMeeting: null, promo: null, todo: null }}
        />
      </Shot>

      <Shot label="③ 모임 탭">
        <MeetView
          data={{
            mine: { id: 'm0', title: '매주 수요일 정기모임', date: '2026-08-20', daysLeft: 3 },
            regular: [
              { id: 'r1', date: '2026-08-20', time: '19:30', venueName: '우연히 책방', confirmedLabel: '6/14명', fee: 12000 },
              { id: 'r2', date: '2026-08-23', time: '14:00', venueName: '공간 지그시', confirmedLabel: '14명 모집 중', fee: 12000 },
              { id: 'r3', date: '2026-08-27', time: '19:30', venueName: '우연히 책방', confirmedLabel: '14명 모집 중', fee: 12000 },
            ],
            discussion: { id: 'm1', title: '사랑의 생애', date: '2026-09-13', time: '14:00', venueName: '우연히 책방', open: true },
          }}
        />
      </Shot>

      <Shot label="④ 이야기 탭 — 신청 열림 + 발제 4">
        <TalkView
          data={{
            discussion: {
              id: 'm1', title: '사랑의 생애', date: '2026-09-13', time: '14:00',
              venueName: '우연히 책방', fee: 25000, open: true, applied: false, isToday: false,
              progress: { answered: 5, total: 8, mine: 2, topicCount: 4 },
            },
            topics,
            past: [
              { id: 'p1', title: '아몬드', monthLabel: '8월' },
              { id: 'p2', title: '파친코', monthLabel: '7월' },
            ],
          }}
        />
      </Shot>

      <Shot label="⑤ 이야기 탭 — 발제 0 + 당일">
        <TalkView
          data={{
            discussion: {
              id: 'm1', title: '사랑의 생애', date: '2026-09-13', time: '14:00',
              venueName: '우연히 책방', fee: 25000, open: false, applied: true, isToday: true,
              progress: null,
            },
            topics: [],
            past: [],
          }}
        />
      </Shot>

      <Shot label="⑥ 발제 스레드 — 신청자">
        <TopicThread topic={topic} answers={answers} canWrite={true} myUserId="me" />
      </Shot>

      <Shot label="⑦ 발제 스레드 — 미신청자">
        <TopicThread topic={topic} answers={answers} canWrite={false} myUserId={null} />
      </Shot>

      <Shot label="⑧ 모임 자리 모드">
        <LiveMode
          meetingTitle="9월 토론모임"
          topics={[
            { ...topic, answers: answers.map((a) => ({ nickname: a.nickname, body: a.body, pinned: a.pinned })) },
            { ...topic, id: 't2', topic_no: 2, title: '도덕, 연애, 결혼', quote: '도덕은 사랑이 아니라 인간됨, 혹은 인간의 인간에 대한 태도에 관련된 문제이다.', quote_page: '76', question: '사랑은 그저 사랑일 뿐일까요?', answers: [] },
          ]}
        />
      </Shot>

      <Shot label="⑨ 알림함">
        <NotificationList items={notifications} />
      </Shot>

      <Shot label="⑩ 알림함 — 빈 상태">
        <NotificationList items={[]} />
      </Shot>
    </div>
  )
}
