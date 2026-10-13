import { Suspense } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { isNextUiEnabled } from '@/lib/next-ui'
import { getUser } from '@/lib/auth'
import { getProfile } from '@/lib/profile'
import { isOnboarded } from '@/lib/onboarding'
import NextNav from '@/components/next/NextNav'
import NotificationBell, { BellLink } from '@/components/next/NotificationBell'

/**
 * next_ui 라우트 그룹 레이아웃.
 * 플래그 OFF면 기존 홈으로 — 새 화면 전체가 이 게이트 뒤에 있다 (전면개편 스펙 §8).
 * 인증은 미들웨어가 처리(미로그인 → /auth/login).
 */
export default async function NextLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // 플래그와 프로필을 동시에 받는다 — 차례로 기다리면 모든 새 화면의 첫 그림이 한 번 더 늦다
  // (2026-10-13 속도 점검). getUser는 쿠키만 읽어 네트워크가 없다.
  const user = await getUser()
  const [nextUi, profile] = await Promise.all([
    isNextUiEnabled(),
    user ? getProfile(user.id) : null,
  ])
  if (!nextUi) redirect('/')

  // 온보딩(웰컴·프로필) 미완성 회원은 관문(/)으로 — 전화·실명 없이 결제까지 가는 우회 차단.
  // /는 미완성자에겐 리다이렉트하지 않으므로(page.tsx·미들웨어) 루프 없음.
  if (user && !isOnboarded(profile)) redirect('/')

  return (
    <div className="min-h-dvh bg-white text-tg-900">
      <header className="mx-auto flex h-12 max-w-screen-sm items-center justify-between pl-5 pr-2">
        <Link
          href="/home"
          className="text-[17px] font-extrabold tracking-tight text-brand-deep"
        >
          지독해
        </Link>
        {user && (
          // 알림 수는 나중에 채운다 — 머리와 뼈대가 이 조회를 기다리지 않게
          <Suspense fallback={<BellLink unread={0} />}>
            <NotificationBell userId={user.id} />
          </Suspense>
        )}
      </header>
      <main className="mx-auto max-w-screen-sm px-5 pb-24">{children}</main>
      <NextNav />
    </div>
  )
}
