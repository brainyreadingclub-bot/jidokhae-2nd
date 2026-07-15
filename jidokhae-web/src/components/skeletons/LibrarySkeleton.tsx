export default function LibrarySkeleton() {
  return (
    <div className="mt-8">
      <div className="h-6 w-24 rounded bg-neutral-100" />
      <div className="mt-3 grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="w-full aspect-[2/3] rounded-[6px] bg-neutral-100" />
        ))}
      </div>
    </div>
  )
}
