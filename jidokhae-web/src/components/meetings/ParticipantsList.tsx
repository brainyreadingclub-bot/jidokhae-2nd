type ParticipantsListProps = {
  nicknames: string[]
}

export default function ParticipantsList({ nicknames }: ParticipantsListProps) {
  if (nicknames.length === 0) return null

  return (
    <section
      className="mx-5 mt-6 rounded-[var(--radius-md)] p-4"
      style={{
        backgroundColor: 'var(--color-surface-100)',
        border: '1px solid var(--color-surface-300)',
      }}
    >
      <div className="mb-3 flex items-center gap-2">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-primary-500"
        >
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        <h3 className="text-sm font-bold text-primary-800">
          함께하는 멤버 <span className="font-mono tabular-nums text-primary-500">({nicknames.length}명)</span>
        </h3>
      </div>
      <ul className="flex flex-wrap gap-2">
        {nicknames.map((nickname, idx) => (
          <li
            key={`${nickname}-${idx}`}
            className="inline-flex items-center rounded-full border border-primary-200 bg-white px-3 py-1 text-xs font-medium text-primary-700"
          >
            {nickname}
          </li>
        ))}
      </ul>
    </section>
  )
}
