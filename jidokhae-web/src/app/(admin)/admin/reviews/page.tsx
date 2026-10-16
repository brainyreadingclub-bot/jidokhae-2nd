import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { getProfile } from '@/lib/profile'
import { isReviewEnabled } from '@/lib/review'
import { ADMIN_REVIEW_RANGE_DAYS, getAdminReviewOverview } from '@/lib/review-admin'
import AdminReviewList from '@/components/admin/reviews/AdminReviewList'

/**
 * 운영자 「모임 후기」 목록 (시안 A1). **총괄운영자(admin)만** — 메뉴(adminOnly) · 이 페이지 · API · RLS 네 겹.
 * 스위치가 꺼져 있어도 이 화면은 열린다(쌓인 후기를 볼 수 있게). 꺼짐이면 머리말에 적는다.
 */
export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ region?: string }>
}) {
  const user = await getUser()
  if (!user) redirect('/auth/login')
  const profile = await getProfile(user.id)
  if (profile.role !== 'admin') redirect('/admin')

  const { region } = await searchParams
  const [overview, enabled] = await Promise.all([
    getAdminReviewOverview(region ?? null),
    isReviewEnabled(),
  ])

  return (
    <AdminReviewList
      overview={overview}
      region={region ?? null}
      enabled={enabled}
      rangeDays={ADMIN_REVIEW_RANGE_DAYS}
    />
  )
}
