import Link from 'next/link'

type Props = {
  showBrowseLink?: boolean
}

export default function EmptyMeetings({ showBrowseLink = false }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      {/* Book icon */}
      <div
        className="mb-5 flex h-16 w-16 items-center justify-center rounded-full"
        style={{
          backgroundColor: 'var(--color-surface-200)',
          border: '1px solid var(--color-surface-300)',
        }}
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-primary-300"
        >
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          <line x1="8" y1="7" x2="16" y2="7" />
          <line x1="8" y1="11" x2="13" y2="11" />
        </svg>
      </div>
      <p className="text-sm font-semibold text-primary-600">
        다가오는 모임이 없습니다
      </p>
      <p className="mt-1.5 text-xs text-primary-400 leading-relaxed">
        새로운 모임이 등록되면<br />여기에 표시됩니다
      </p>
      {showBrowseLink && (
        <Link
          href="/"
          className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors"
        >
          모임 둘러보기
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>
      )}
    </div>
  )
}
