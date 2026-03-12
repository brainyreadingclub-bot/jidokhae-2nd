import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import BottomNav from '@/components/BottomNav'
import LogoutButton from '@/components/LogoutButton'

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    let nickname = ''
    let role = 'member'
    if (user) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('nickname, role')
        .eq('id', user.id)
        .single()
      if (profileError) {
        console.error('[MainLayout] profile error:', profileError)
      }
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
  } catch (err) {
    const msg = err instanceof Error ? err.message + '\n' + err.stack : String(err)
    return (
      <div className="px-4 pt-6">
        <h1 className="text-lg font-bold text-red-600">Layout 에러</h1>
        <pre className="mt-4 whitespace-pre-wrap break-all rounded bg-gray-100 p-4 text-xs">{msg}</pre>
      </div>
    )
  }
}
