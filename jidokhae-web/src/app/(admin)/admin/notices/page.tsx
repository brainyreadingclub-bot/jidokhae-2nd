import { createServiceClient } from '@/lib/supabase/admin'
import AnnouncementForm from '@/components/admin/AnnouncementForm'

/**
 * 인앱 공지 보내기 (2026-08-17 시안 D).
 * admin 전용 — (admin) 레이아웃이 역할 검사, adminMenu에서 editor에게 숨김,
 * API가 최종 방어선.
 */
export default async function AdminNoticesPage() {
  const admin = createServiceClient()
  const { count } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })

  return (
    <div className="max-w-xl">
      <h1 className="text-lg font-bold text-neutral-900">공지 보내기</h1>
      <p className="mt-1 mb-6 text-sm text-neutral-600">
        전 회원의 앱 알림함에 공지를 넣습니다
      </p>
      <AnnouncementForm memberCount={count ?? 0} />
    </div>
  )
}
