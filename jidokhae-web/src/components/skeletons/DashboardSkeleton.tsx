function SkeletonRow() {
  return (
    <div className="flex items-center justify-between rounded-[var(--radius-md)] bg-white px-4 py-3 shadow-[var(--shadow-card)]">
      <div className="flex-1 space-y-2">
        <div className="h-4 w-2/3 animate-pulse rounded bg-gray-100" />
        <div className="h-3 w-1/3 animate-pulse rounded bg-gray-100" />
      </div>
      <div className="h-5 w-12 animate-pulse rounded bg-gray-100" />
    </div>
  )
}

export default function DashboardSkeleton() {
  return (
    <div className="px-5 pt-4 pb-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="h-6 w-20 animate-pulse rounded bg-gray-100" />
        <div className="h-8 w-16 animate-pulse rounded-[var(--radius-md)] bg-gray-100" />
      </div>
      {/* Meeting list */}
      <div className="flex flex-col gap-2">
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </div>
    </div>
  )
}
