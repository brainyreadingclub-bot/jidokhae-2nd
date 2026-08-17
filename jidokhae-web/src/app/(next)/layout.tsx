import { redirect } from 'next/navigation'
import { isNextUiEnabled } from '@/lib/next-ui'
import { getUser } from '@/lib/auth'
import NextNav from '@/components/next/NextNav'
import NotificationBell from '@/components/next/NotificationBell'

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
  if (!(await isNextUiEnabled())) redirect('/')
  const user = await getUser()

  return (
    <div className="min-h-dvh bg-white text-tg-900">
      <header className="mx-auto flex h-12 max-w-screen-sm items-center justify-between pl-5 pr-2">
        <span className="text-[17px] font-extrabold tracking-tight text-brand-deep">
          지독해
        </span>
        {user && <NotificationBell userId={user.id} />}
      </header>
      <main className="mx-auto max-w-screen-sm px-5 pb-24">{children}</main>
      <NextNav />
    </div>
  )
}
