export default function MeetingDetailLoading() {
  return (
    <div className="px-4 pt-4 pb-6">
      {/* Back link */}
      <div className="mb-4 h-5 w-16 animate-pulse rounded bg-gray-100" />

      {/* Title */}
      <div className="h-6 w-3/4 animate-pulse rounded bg-gray-100" />

      {/* Date & time */}
      <div className="mt-3 flex items-center gap-2">
        <div className="h-5 w-24 animate-pulse rounded-[var(--radius-sm)] bg-gray-100" />
        <div className="h-4 w-14 animate-pulse rounded bg-gray-100" />
      </div>

      {/* Location */}
      <div className="mt-3 h-4 w-32 animate-pulse rounded bg-gray-100" />

      {/* Participant count */}
      <div className="mt-2 h-4 w-20 animate-pulse rounded bg-gray-100" />

      {/* Description block */}
      <div className="mt-6 space-y-2">
        <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-gray-100" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-gray-100" />
      </div>

      {/* Action button */}
      <div className="mt-8 h-12 w-full animate-pulse rounded-[var(--radius-md)] bg-gray-100" />
    </div>
  )
}
