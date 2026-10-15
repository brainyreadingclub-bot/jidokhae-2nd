import { Suspense } from 'react'
import Link from 'next/link'
import { getUser } from '@/lib/auth'
import { getProfile } from '@/lib/profile'
import BottomNav from '@/components/BottomNav'
import NextNav from '@/components/next/NextNav'
import LogoutButton from '@/components/LogoutButton'
import NotificationBell, { BellLink } from '@/components/next/NotificationBell'
import Footer from '@/components/Footer'
import { isNextUiEnabled } from '@/lib/next-ui'

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getUser()
  // next_ui ON이면 남아 있는 구 화면(/my, 결제 redirect 등)에도 5탭을 붙인다.
  // 안 붙이면 "모임 일정"(=/) 탭이 홈으로 가서 라벨과 도착지가 어긋나고,
  // 회원이 5탭에서 2탭으로 떨어져 자기 위치를 잃는다 (2026-08-25 조사 §2-2).
  // 플래그와 프로필은 서로 무관하다 — 동시에 받는다 (2026-10-13 속도 점검)
  const [nextUi, profile] = await Promise.all([
    isNextUiEnabled(),
    user ? getProfile(user.id) : null,
  ])
  // next_ui ON이면 머리글·아래 탭을 `(next)/layout.tsx`와 같은 모양으로 그린다.
  // 지금 이 그룹에서 회원에게 실제로 그려지는 건 결제 확인 중·결제 실패 두 장뿐이다
  // (상세·신청 완료·마이페이지는 새 주소로 넘어간다). 옛 머리글(「닉네임님 · 로그아웃」)과
  // 사업자 정보 푸터가 그 두 장에만 남아 있었다 (2026-10-13 화면 점검 27·28번)
  if (nextUi) {
    return (
      <div className="min-h-dvh bg-white text-tg-900">
        <header className="mx-auto flex h-12 max-w-screen-sm items-center justify-between pl-5 pr-2">
          <Link href="/home" className="text-[17px] font-extrabold tracking-tight text-brand-deep">
            지독해
          </Link>
          {user && (
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

  const nickname = profile?.nickname || ''
  const role = profile?.role || 'member'

  return (
    <>
      <header className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid var(--color-surface-300)' }}>
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-semibold text-primary-800 tracking-tight">
            {nickname || '회원'}님
          </span>
          {(role === 'admin' || role === 'editor') && (
            <Link
              href="/admin"
              className="text-[10px] font-bold tracking-wider uppercase text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full hover:bg-primary-100 transition-colors"
            >
              {role === 'admin' ? '총괄' : '운영진'}
            </Link>
          )}
        </div>
        <LogoutButton />
      </header>
      <div style={{ paddingBottom: `calc(${nextUi ? '56px' : '64px'} + env(safe-area-inset-bottom, 16px))` }}>
        {children}
        <Footer />
      </div>
      {nextUi ? <NextNav /> : <BottomNav />}
    </>
  )
}
