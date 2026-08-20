import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import HomeContent from '@/components/home/HomeContent'
import NoticeStrip from '@/components/home/NoticeStrip'
import MeetingListSkeleton from '@/components/skeletons/MeetingListSkeleton'
import { isNextUiEnabled } from '@/lib/next-ui'
import { getSiteSettings } from '@/lib/site-settings'
import { getUser } from '@/lib/auth'
import { getProfile } from '@/lib/profile'
import { isOnboarded } from '@/lib/onboarding'

export default async function HomePage() {
  // 전면개편 플래그 ON이면 새 홈으로 — 단, 온보딩(웰컴·프로필) 완료자만.
  // 미완성 회원은 이 페이지의 HomeContent 이중 게이트가 관문을 렌더한다.
  // 그 외 구경로(meetings/[id], /my 등)는 그대로 동작 (스펙 §6·§10)
  if (await isNextUiEnabled()) {
    const user = await getUser()
    if (user && isOnboarded(await getProfile(user.id))) redirect('/home')
  }
  const settings = await getSiteSettings()
  const noticeText = (settings['notice_text'] ?? '').trim()
  return (
    <div className="px-5 pt-6">
      {noticeText && <NoticeStrip text={noticeText} />}
      <h1 className="text-[22px] font-bold leading-tight tracking-tight text-neutral-900" style={{ fontFamily: 'var(--font-display)' }}>지독하게, 함께 읽어요</h1>
      <Suspense fallback={<MeetingListSkeleton />}>
        <HomeContent />
      </Suspense>
    </div>
  )
}
