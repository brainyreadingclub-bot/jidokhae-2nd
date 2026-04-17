import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { getProfile } from '@/lib/profile'
import AdminSidebar from '@/components/admin/AdminSidebar'
import AdminMobileNav from '@/components/admin/AdminMobileNav'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getUser()

  if (!user) redirect('/auth/login')

  const profile = await getProfile(user.id)

  if (profile.role !== 'admin' && profile.role !== 'editor') redirect('/')

  const role = profile.role as 'admin' | 'editor'
  const nickname = profile.nickname || user.email || '운영자'

  return (
    <div className="min-h-screen">
      {/* 모바일 헤더 + Drawer */}
      <AdminMobileNav role={role} nickname={nickname} />

      {/* 데스크톱 고정 사이드바 */}
      <aside className="fixed inset-y-0 left-0 hidden w-[220px] lg:block">
        <AdminSidebar role={role} nickname={nickname} />
      </aside>

      {/* Main — 데스크톱에서는 사이드바 폭만큼 오프셋 */}
      <main className="min-h-[calc(100vh-56px)] lg:ml-[220px] lg:min-h-screen">
        {children}
      </main>
    </div>
  )
}
