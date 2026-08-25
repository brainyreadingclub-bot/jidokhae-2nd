import Link from 'next/link'
import { getUser } from '@/lib/auth'
import { getProfile } from '@/lib/profile'
import BottomNav from '@/components/BottomNav'
import NextNav from '@/components/next/NextNav'
import LogoutButton from '@/components/LogoutButton'
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
  const nextUi = await isNextUiEnabled()

  let nickname = ''
  let role = 'member'
  if (user) {
    const profile = await getProfile(user.id)
    nickname = profile.nickname || ''
    role = profile.role || 'member'
  }

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
              {role === 'admin' ? '운영자' : '운영진'}
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
