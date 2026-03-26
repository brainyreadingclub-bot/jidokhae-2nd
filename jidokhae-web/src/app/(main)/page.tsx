import { Suspense } from 'react'
import HomeContent from '@/components/home/HomeContent'
import MeetingListSkeleton from '@/components/skeletons/MeetingListSkeleton'

export default function HomePage() {
  return (
    <div className="px-5 pt-6">
      <h1 className="text-xl font-extrabold text-primary-900 tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>모임 일정</h1>
      <Suspense fallback={<MeetingListSkeleton />}>
        <HomeContent />
      </Suspense>
    </div>
  )
}
