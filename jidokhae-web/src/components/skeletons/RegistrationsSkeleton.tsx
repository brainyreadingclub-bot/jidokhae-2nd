function SkeletonCard() {
  return (
    <div className="rounded-[var(--radius-lg)] border-l-[3px] border-gray-200 bg-white px-4 py-4 shadow-[var(--shadow-card)]">
      <div className="mb-2 flex items-center gap-2">
        <div className="h-5 w-16 animate-pulse rounded-full bg-gray-100" />
        <div className="h-4 w-20 animate-pulse rounded bg-gray-100" />
      </div>
      <div className="h-5 w-2/3 animate-pulse rounded bg-gray-100" />
      <div className="mt-2 h-4 w-1/3 animate-pulse rounded bg-gray-100" />
    </div>
  )
}

export default function RegistrationsSkeleton() {
  return (
    <div>
      <div className="mt-5 mb-3 h-4 w-20 animate-pulse rounded bg-gray-100" />
      <div className="flex flex-col gap-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  )
}
