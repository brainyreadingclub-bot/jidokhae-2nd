import { Suspense } from 'react'
import BackLink from '@/components/next/BackLink'
import ProfileSection from '@/components/my/ProfileSection'
import ProfileSkeleton from '@/components/skeletons/ProfileSkeleton'

/**
 * 나 탭 → 프로필 · 설정. 「나」가 구 `/my`로 내보내던 자리다.
 * 같은 `ProfileSection`을 쓴다 — 닉네임 1회 변경 규칙·낙관적 락이 두 벌이 되지 않는다.
 * 🔴 구 `/my`는 지우지 않는다 (플래그 OFF 롤백 경로).
 */
export default function NextProfilePage() {
  return (
    <div className="pt-1">
      <BackLink href="/me" label="프로필 · 설정" />
      <Suspense fallback={<ProfileSkeleton />}>
        <ProfileSection />
      </Suspense>
    </div>
  )
}
