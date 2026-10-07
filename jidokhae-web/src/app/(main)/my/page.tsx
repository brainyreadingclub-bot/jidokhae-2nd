import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { isNextUiEnabled } from '@/lib/next-ui'
import { isLibraryEnabled } from '@/lib/library'
import { getPendingAsk } from '@/lib/asks'
import MyRegistrationContent from '@/components/my/MyRegistrationContent'
import RegistrationsSkeleton from '@/components/skeletons/RegistrationsSkeleton'
import ProfileSection from '@/components/my/ProfileSection'
import ProfileSkeleton from '@/components/skeletons/ProfileSkeleton'
import LibrarySection from '@/components/library/LibrarySection'
import AskStripSection from '@/components/library/AskStripSection'
import HashScroller from '@/components/my/HashScroller'

/**
 * 구 마이페이지. `next_ui`가 켜지면 회원은 5탭 안에서 살아야 하는데, 승인된
 * 「물어보기」 알림톡의 「책 담기」 버튼 주소가 `/my`로 템플릿에 박혀 있어 고칠 수 없다.
 * 그래서 들어오는 사람을 5탭 안으로 되돌린다.
 *
 * 🔴 **단순 리다이렉트가 아니다.** 미해소 물어보기가 있으면 `/shelf`로 — 거기에만
 * 물어보기를 해소(`answered`)하고 출처를 「N월 모임에서」로 기록하는 담기 경로가 있다
 * (`AskStripSection` → `AskStrip` → `BookSearchInput askMeetingId` →
 * `POST /api/library/ask {action:'answer'}`). `/shelf/manage`로 보내면 `askMeetingId`가
 * 없어 「직접 담았어요」로 들어가고 물어보기는 영구 미해소로 남는다.
 * 없으면 `/me`(신청 내역·프로필)로 보낸다.
 *
 * 보내는 조건을 `AskStripSection`과 **같은 함수·같은 플래그**로 맞춘다 — 기준이 갈리면
 * 「보냈는데 스트립이 없는」 빈 화면이 난다.
 *
 * 🔴 아래 구 화면 코드는 한 줄도 지우지 않는다. 플래그를 OFF로 되돌리면 그게 유일한 경로다.
 */
export default async function MyPage() {
  if (await isNextUiEnabled()) {
    const user = await getUser()
    // 로그인 전(미들웨어가 막지만 방어적으로)에는 아래 구 화면이 로그인으로 보낸다
    if (user) {
      const pending = (await isLibraryEnabled()) ? await getPendingAsk(user.id) : null
      redirect(pending ? '/shelf' : '/me')
    }
  }

  return (
    <div className="px-5 pt-6">
      {/* 섹션이 Suspense로 늦게 도착해 기본 앵커가 안 먹는다 — 클라이언트에서 보정 */}
      <HashScroller />
      <Suspense fallback={<ProfileSkeleton />}>
        <ProfileSection />
      </Suspense>

      <Suspense fallback={null}>
        <AskStripSection />
      </Suspense>

      {/* 서재는 조건부 섹션(콜드스타트 B안 — 책 0권 + 물어보기 없으면 미렌더)이라
          스켈레톤을 두지 않는다. 안 나올 서재를 예고했다 사라지면 B안이 없애려던
          노이즈가 그대로 남는다. 바로 위 AskStripSection도 같은 이유로 fallback={null}. */}
      <Suspense fallback={null}>
        <LibrarySection />
      </Suspense>

      {/* id는 나 탭 「신청 내역」이 /my#registrations로 여기 내려오기 위한 앵커
          (프로필 · 설정은 앵커 없이 맨 위로 간다) */}
      <h1 id="registrations" className="mt-8 text-xl font-extrabold text-neutral-800 tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>내 신청</h1>
      <Suspense fallback={<RegistrationsSkeleton />}>
        <MyRegistrationContent />
      </Suspense>
    </div>
  )
}
