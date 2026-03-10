import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import BottomNav from '@/components/BottomNav'
import LogoutButton from '@/components/LogoutButton'

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
    const { data: profile } = await supabase
      .from('profiles')
      .select('nickname, role')
      .eq('id', user.id)
      .single()
    nickname = profile?.nickname || ''
    role = profile?.role || 'member'
  }

  return (
    <>
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">
            {nickname || '회원'}님
          </span>
          {role === 'admin' && (
            <Link
              href="/admin"
              className="text-xs font-medium text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded hover:bg-primary-100 transition-colors"
            >
              운영자
            </Link>
          )}
        </div>
        <LogoutButton />
      </header>
      <div className="pb-20">
        {children}
      </div>
      <BottomNav />
    </>
  )
}
