import { Suspense } from 'react'
import HomeContent from '@/components/home/HomeContent'
import MeetingListSkeleton from '@/components/skeletons/MeetingListSkeleton'

export default function HomePage() {
  return (
    <div className="px-5 pt-6">
      <h1 className="text-[22px] font-bold leading-tight tracking-tight text-neutral-900" style={{ fontFamily: 'var(--font-display)' }}>지독하게, 함께 읽어요</h1>
      <Suspense fallback={<MeetingListSkeleton />}>
        <HomeContent />
      </Suspense>
    </div>
  )
}
