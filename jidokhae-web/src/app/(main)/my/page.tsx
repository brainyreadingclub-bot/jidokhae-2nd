import { Suspense } from 'react'
import MyRegistrationContent from '@/components/my/MyRegistrationContent'
import RegistrationsSkeleton from '@/components/skeletons/RegistrationsSkeleton'

export default function MyPage() {
  return (
    <div className="px-5 pt-6">
      <h1 className="text-xl font-extrabold text-neutral-800 tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>내 신청</h1>
      <Suspense fallback={<RegistrationsSkeleton />}>
        <MyRegistrationContent />
      </Suspense>
    </div>
  )
}
