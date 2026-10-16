import { notFound, redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { getProfile } from '@/lib/profile'
import { getAdminMeetingReviewDetail } from '@/lib/review-admin'
import AdminMeetingReview from '@/components/admin/reviews/AdminMeetingReview'

/**
 * 운영자 「모임 후기」 한 모임 (시안 A2 · 아직 0건이면 A3). **총괄운영자(admin)만.**
 * 표정 분포 · 아쉬운 점 · 첫 모임 회원의 표정 + 14일 안 재신청 · 한 줄 소감(공개 상태 · 「내리기」).
 * 운영자가 내린 소감도 목록에 남긴다 — 사라지면 풀 길이 없어진다(사후 잔재 4시나리오 3번).
 */
export default async function AdminMeetingReviewPage({
  params,
}: {
  params: Promise<{ meetingId: string }>
}) {
  const user = await getUser()
  if (!user) redirect('/auth/login')
  const profile = await getProfile(user.id)
  if (profile.role !== 'admin') redirect('/admin')

  const { meetingId } = await params
  const d = await getAdminMeetingReviewDetail(meetingId)
  if (!d) notFound()

  return <AdminMeetingReview d={d} />
}
