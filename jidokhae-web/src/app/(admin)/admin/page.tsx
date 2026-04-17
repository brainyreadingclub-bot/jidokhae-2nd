import { Suspense } from 'react'
import AdminDashboardHub from '@/components/admin/AdminDashboardHub'
import DashboardSkeleton from '@/components/skeletons/DashboardSkeleton'

export default function AdminPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <AdminDashboardHub />
    </Suspense>
  )
}
