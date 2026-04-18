import { Suspense } from 'react'
import HomeTabContent from '@/components/home/HomeTabContent'

export default function HomePage() {
  return (
    <div className="px-5 pt-5 pb-6">
      <Suspense fallback={<HomeSkeleton />}>
        <HomeTabContent />
      </Suspense>
    </div>
  )
}

function HomeSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-12 rounded-lg" style={{ backgroundColor: 'var(--color-surface-200)' }} />
      <div className="h-32 rounded-lg" style={{ backgroundColor: 'var(--color-surface-200)' }} />
      <div className="h-20 rounded-lg" style={{ backgroundColor: 'var(--color-surface-200)' }} />
    </div>
  )
}
