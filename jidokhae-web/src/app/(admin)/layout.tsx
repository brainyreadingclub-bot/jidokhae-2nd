import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { getProfile } from '@/lib/profile'
import Link from 'next/link'
import Footer from '@/components/Footer'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getUser()

  if (!user) redirect('/auth/login')

  const profile = await getProfile(user.id)

  if (profile.role !== 'admin' && profile.role !== 'editor') redirect('/')

  return (
    <>
      <header className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid var(--color-surface-300)' }}>
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center justify-center w-8 h-8 rounded-full text-primary-600 hover:bg-primary-50 transition-colors"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
          <span className="text-sm font-bold text-primary-800 tracking-tight">
            모임 관리
          </span>
        </div>
        <span className="text-[10px] font-bold tracking-wider uppercase text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">
          {profile.role === 'admin' ? '운영자' : '운영진'}
        </span>
      </header>
      <div>{children}</div>
      <Footer />
    </>
  )
}
