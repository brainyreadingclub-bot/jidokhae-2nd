import { Suspense } from 'react'
import AdminDashboardContent from '@/components/admin/AdminDashboardContent'
import DashboardSkeleton from '@/components/skeletons/DashboardSkeleton'

type Props = {
  searchParams: Promise<{ filter?: string }>
}

export default async function AdminPage({ searchParams }: Props) {
  const { filter = 'active' } = await searchParams

  return (
    <div className="px-5 pt-4 pb-6">
      <Suspense fallback={<DashboardSkeleton />}>
        <AdminDashboardContent filter={filter} />
      </Suspense>
    </div>
  )
}
