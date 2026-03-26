import Link from 'next/link'

export default function MeetingDetailLoading() {
  return (
    <div className="px-5 pt-4">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-400 hover:text-primary-600 transition-colors mb-5"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        목록으로
      </Link>
    </div>
  )
}
