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
    // 전체 폭: root 레이아웃의 max-w-screen-sm(640) 캡은 globals.css가 푼다
    //   ([data-root-frame]:has([data-admin-root]) — 운영자 화면이 들어 있을 때만).
    // 🔴 예전에는 w-screen(100vw) + 음수 마진으로 캡을 벗어났는데, 100vw는 세로 스크롤바 폭까지 잡아
    //    스크롤바가 있는 화면(폰 포함)에서 늘 가로 스크롤이 생겼다(2026-10-09 360·390 실측). vw를 쓰지 않는다.
    // ⚠️ transform(-translate-*) 금지 — 아래 fixed 사이드바의 기준이 뷰포트에서 이 div로 바뀌어 깨진다.
    <div data-admin-root className="min-h-screen bg-surface-50">
      {/* 모바일 헤더 + Drawer */}
      <AdminMobileNav role={role} nickname={nickname} />

      {/* 데스크톱 고정 사이드바 */}
      <aside className="fixed inset-y-0 left-0 hidden w-[220px] lg:block">
        <AdminSidebar role={role} nickname={nickname} />
      </aside>

      {/* Main — 데스크톱에서는 사이드바 폭만큼 오프셋 */}
      <main className="min-h-[calc(100vh-56px)] lg:ml-[220px] lg:min-h-screen">
        {/* 초광폭 화면에서 가독성 유지 — 콘텐츠 최대폭 제한.
            ⚠️ mx-auto(중앙정렬) 금지 — 사이드바가 왼쪽 고정이라 콘텐츠를 중앙정렬하면
            초광폭 모니터에서 사이드바와 콘텐츠 사이에 큰 빈 공간이 생긴다(콘텐츠가 우측으로 밀려 보임).
            좌측 정렬로 콘텐츠가 사이드바에 붙고 남는 여백은 우측으로 보낸다(Linear/Notion 패턴).
            여백은 **여기 한 곳에서** 정한다 (2026-10-09). 페이지마다 각자 붙이던 때는
            발제문·공지·서재가 좌우 0, 새 모임·수정이 데스크톱 20px로 제각각이었다.
            페이지 최상위에 px-*·mx-auto를 다시 붙이지 말 것.
            ⚠️ 여기에도 transform 금지 — 위 full-bleed 주석과 같은 이유(fixed 자식 기준이 바뀐다). */}
        <div className="max-w-[1400px] px-5 pt-6 pb-10 lg:px-10 lg:pt-10">
          {children}
        </div>
      </main>
    </div>
  )
}
