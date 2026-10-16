import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { getProfile } from '@/lib/profile'
import { adminAreaOf } from '@/lib/admin-access'

/**
 * 스텝 구역 — 발제문만 (2026-10-16 대표님 결정, 허용 목록 방식). 화면 목록은 `lib/admin-access.ts` STAFF_PAGES.
 * 총괄·운영진도 들어올 수 있다(발제문 권한은 큐레이터 셋 공통). 회원은 첫 화면으로.
 * 전체 폭 캡을 푸는 표시(data-admin-root)는 운영 화면과 같은 것을 쓴다.
 */
export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser()
  if (!user) redirect('/auth/login')

  const profile = await getProfile(user.id)
  if (adminAreaOf(profile) === 'none') redirect('/')

  return (
    <div data-admin-root className="min-h-screen bg-surface-50">
      <header
        className="flex h-14 items-center justify-between bg-white px-5 lg:px-10"
        style={{ borderBottom: '1px solid var(--color-surface-300)' }}
      >
        <Link href="/staff/topics" className="text-sm font-extrabold tracking-tight text-primary-900">
          지독해 <span className="ml-1 text-[11px] font-bold tracking-wider text-primary-600">발제문</span>
        </Link>
        <Link href="/" className="text-xs font-semibold text-primary-500 hover:text-primary-700">
          회원 화면으로
        </Link>
      </header>
      <main className="max-w-[1000px] px-5 pt-6 pb-10 lg:px-10 lg:pt-10">{children}</main>
    </div>
  )
}
