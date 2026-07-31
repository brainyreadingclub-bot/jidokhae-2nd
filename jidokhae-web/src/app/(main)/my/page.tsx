import { Suspense } from 'react'
import MyRegistrationContent from '@/components/my/MyRegistrationContent'
import RegistrationsSkeleton from '@/components/skeletons/RegistrationsSkeleton'
import ProfileSection from '@/components/my/ProfileSection'
import ProfileSkeleton from '@/components/skeletons/ProfileSkeleton'
import LibrarySection from '@/components/library/LibrarySection'
import AskStripSection from '@/components/library/AskStripSection'

export default function MyPage() {
  return (
    <div className="px-5 pt-6">
      <Suspense fallback={<ProfileSkeleton />}>
        <ProfileSection />
      </Suspense>

      <Suspense fallback={null}>
        <AskStripSection />
      </Suspense>

      {/* 서재는 조건부 섹션(콜드스타트 B안 — 책 0권 + 물어보기 없으면 미렌더)이라
          스켈레톤을 두지 않는다. 안 나올 서재를 예고했다 사라지면 B안이 없애려던
          노이즈가 그대로 남는다. 바로 위 AskStripSection도 같은 이유로 fallback={null}. */}
      <Suspense fallback={null}>
        <LibrarySection />
      </Suspense>

      <h1 className="mt-8 text-xl font-extrabold text-neutral-800 tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>내 신청</h1>
      <Suspense fallback={<RegistrationsSkeleton />}>
        <MyRegistrationContent />
      </Suspense>
    </div>
  )
}
