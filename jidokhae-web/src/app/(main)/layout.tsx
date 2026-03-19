import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/profile'
import BottomNav from '@/components/BottomNav'
import LogoutButton from '@/components/LogoutButton'
import Footer from '@/components/Footer'

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

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
      <div style={{ paddingBottom: 'calc(64px + env(safe-area-inset-bottom, 16px))' }}>
        {children}
        <Footer />
      </div>
      <BottomNav />
    </>
  )
}
