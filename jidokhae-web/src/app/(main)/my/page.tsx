import { Suspense } from 'react'
import MyRegistrationContent from '@/components/my/MyRegistrationContent'
import RegistrationsSkeleton from '@/components/skeletons/RegistrationsSkeleton'
import ProfileSection from '@/components/my/ProfileSection'
import ProfileSkeleton from '@/components/skeletons/ProfileSkeleton'

export default function MyPage() {
  return (
    <div className="px-5 pt-6">
      <Suspense fallback={<ProfileSkeleton />}>
        <ProfileSection />
      </Suspense>

      <h1 className="mt-8 text-xl font-extrabold text-neutral-800 tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>내 신청</h1>
      <Suspense fallback={<RegistrationsSkeleton />}>
        <MyRegistrationContent />
      </Suspense>
    </div>
  )
}
