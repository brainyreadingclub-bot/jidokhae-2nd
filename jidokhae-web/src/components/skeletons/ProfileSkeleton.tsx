export default function ProfileSkeleton() {
  return (
    <section className="animate-pulse">
      <div className="mb-3 h-7 w-24 rounded bg-neutral-200" />
      <div className="rounded-[var(--radius-md)] border border-neutral-200 bg-surface-50 px-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={`flex items-center py-3 ${i < 4 ? 'border-b border-neutral-200' : ''}`}>
            <div className="h-4 w-12 rounded bg-neutral-200" />
            <div className="ml-4 h-4 w-32 rounded bg-neutral-200" />
          </div>
        ))}
      </div>
    </section>
  )
}
