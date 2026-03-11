function SkeletonCard() {
  return (
    <div className="rounded-[var(--radius-lg)] border-l-[3px] border-gray-200 bg-white px-4 py-4 shadow-[var(--shadow-card)]">
      {/* Date chip */}
      <div className="mb-2 flex items-center gap-2">
        <div className="h-5 w-20 animate-pulse rounded-[var(--radius-sm)] bg-gray-100" />
        <div className="h-4 w-12 animate-pulse rounded bg-gray-100" />
      </div>
      {/* Title */}
      <div className="h-5 w-3/4 animate-pulse rounded bg-gray-100" />
      {/* Details row */}
      <div className="mt-3 flex items-center gap-3">
        <div className="h-4 w-16 animate-pulse rounded bg-gray-100" />
        <div className="h-4 w-14 animate-pulse rounded bg-gray-100" />
        <div className="h-4 w-12 animate-pulse rounded bg-gray-100" />
      </div>
    </div>
  )
}

export default function MainLoading() {
  return (
    <div className="px-4 pt-6">
      <div className="h-7 w-24 animate-pulse rounded bg-gray-100" />
      <div className="mt-4 flex flex-col gap-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  )
}
