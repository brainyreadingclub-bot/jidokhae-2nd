import Link from 'next/link'

type Props = {
  title: string
  milestone: string // e.g. "M8", "M10", "WP7-4"
  description: string
}

/**
 * 아직 구현되지 않은 admin 페이지의 임시 placeholder.
 * 사이드바 메뉴 클릭 → 이 페이지로 연결되어 "어떤 기능이 올 것인지" 먼저 보여줌.
 */
export default function PlaceholderPage({ title, milestone, description }: Props) {
  return (
    <div className="mx-auto max-w-2xl px-5 py-12 lg:px-10 lg:py-16">
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-600">
        준비 중 · {milestone} 도착 예정
      </div>
      <h1
        className="mb-4 text-2xl font-extrabold tracking-tight text-primary-900"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {title}
      </h1>
      <p className="mb-8 text-[14px] leading-relaxed text-neutral-600">
        {description}
      </p>

      <div
        className="rounded-[var(--radius-md)] border px-5 py-4"
        style={{
          borderColor: 'var(--color-surface-300)',
          backgroundColor: 'var(--color-surface-50)',
        }}
      >
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
          지금 할 수 있는 것
        </div>
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary-700 hover:text-primary-800"
        >
          대시보드로 돌아가기
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>
      </div>
    </div>
  )
}
