// 버튼 즉시 반응 시험대 — `npm run test:buttons`(scripts/verify-buttons.mjs)만 쓴다.
// BUTTON_LAB=on일 때만 열리고, 그 밖에서는 404다. 데이터는 전부 가짜이고 Supabase·실제 API를 부르지 않는다
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import TopicThread from '@/components/next/TopicThread'
import LibraryGrid from '@/components/library/LibraryGrid'
import LibraryToastProvider from '@/components/library/LibraryToast'
import AskStrip from '@/components/library/AskStrip'
import ProfileEditor from '@/components/my/ProfileEditor'
import type { DiscussionTopic, AnswerWithMeta } from '@/types/discussion'
import type { LibraryEntryWithBook } from '@/types/book'

export const dynamic = 'force-dynamic'

// 시험 스크립트가 완독 저장을 흉내 낼 때 이 쿠키에 저장된 값을 남긴다 — router.refresh() 뒤 서버가 그 값을 돌려준다
const COMPLETED_COOKIE = 'button_lab_completed'

const now = '2026-10-13T00:00:00Z'
const topic = {
  id: 't1', meeting_id: 'm1', topic_no: 1, title: '발제', quote: '인용문', quote_page: '12',
  question: '어떻게 생각하세요?', author_id: 'u0', published_at: now, created_at: now,
} as DiscussionTopic
const answers: AnswerWithMeta[] = [
  { id: 'a1', topic_id: 't1', user_id: 'u2', body: '다른 회원 답변', pinned: false, created_at: now, updated_at: now, nickname: '초록고래', reaction_count: 2, reply_count: 0, my_reacted: false },
]

export default async function ButtonLabPage() {
  if (process.env.BUTTON_LAB !== 'on') notFound()

  const completed = (await cookies()).get(COMPLETED_COOKIE)?.value === '1'
  const entries: LibraryEntryWithBook[] = [
    { id: 'e1', user_id: 'u1', book_id: 'b1', source: 'manual', source_meeting_id: null, completed, created_at: now,
      books: { id: 'b1', isbn13: null, title: '시험 책', authors: '저자', publisher: null, thumbnail: null, description: null, created_at: now } },
  ]

  return (
    <div className="mx-auto max-w-screen-sm p-5">
      <div id="thread">
        <TopicThread topic={topic} answers={answers} answerCount={1} canRead canWrite applyCta="apply" myUserId="u1" />
      </div>
      <div id="grid">
        <LibraryToastProvider>
          <LibraryGrid entries={entries} />
        </LibraryToastProvider>
      </div>
      <div id="ask">
        <AskStrip meetingId="m1" meetingLabel="10월 정기모임" />
      </div>
      <div id="profile">
        <ProfileEditor nickname="시험회원" realName="홍길동" phone="01012345678" region={['경주']} email={null} nicknameLock="changed" />
      </div>
    </div>
  )
}
