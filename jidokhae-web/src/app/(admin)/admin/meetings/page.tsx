import { Suspense } from 'react'
import Link from 'next/link'
import AdminMeetingsList from '@/components/admin/AdminMeetingsList'
import DashboardSkeleton from '@/components/skeletons/DashboardSkeleton'

type Props = {
  searchParams: Promise<{ filter?: string; region?: string }>
}

export default async function AdminMeetingsPage({ searchParams }: Props) {
  const { filter = 'active', region = 'all' } = await searchParams

  return (
    <div className="px-5 pt-6 pb-10 lg:px-10 lg:pt-10">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-500">
            운영
          </div>
          <h1
            className="mt-1 text-2xl font-extrabold tracking-tight text-primary-900"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            모임 관리
          </h1>
        </div>
        <Link
          href="/admin/meetings/new"
          className="inline-flex items-center gap-1.5 rounded-full bg-primary-600 px-4 py-2 text-xs font-bold text-white tracking-wide transition-all hover:bg-primary-700 active:scale-[0.97]"
          style={{ boxShadow: '0 2px 8px rgba(27, 67, 50, 0.2)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          새 모임
        </Link>
      </div>

      <Suspense fallback={<DashboardSkeleton />}>
        <AdminMeetingsList filter={filter} region={region} />
      </Suspense>
    </div>
  )
}
