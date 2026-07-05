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
    // full-bleed: root 레이아웃의 max-w-screen-sm(640) 캡을 벗어나 admin을 전체 폭으로.
    // ⚠️ transform(-translate-*) 금지 — 아래 fixed 사이드바의 기준이 뷰포트에서 이 div로 바뀌어 깨진다.
    // 음수 마진 기법은 containing block을 만들지 않아 fixed가 뷰포트 기준을 유지한다.
    <div className="min-h-screen w-screen ml-[calc(-50vw+50%)] mr-[calc(-50vw+50%)] bg-surface-50">
      {/* 모바일 헤더 + Drawer */}
      <AdminMobileNav role={role} nickname={nickname} />

      {/* 데스크톱 고정 사이드바 */}
      <aside className="fixed inset-y-0 left-0 hidden w-[220px] lg:block">
        <AdminSidebar role={role} nickname={nickname} />
      </aside>

      {/* Main — 데스크톱에서는 사이드바 폭만큼 오프셋 */}
      <main className="min-h-[calc(100vh-56px)] lg:ml-[220px] lg:min-h-screen">
        {/* 초광폭 화면에서 가독성 유지 — 콘텐츠 최대폭 제한 + 중앙정렬 */}
        <div className="mx-auto max-w-[1400px]">
          {children}
        </div>
      </main>
    </div>
  )
}
