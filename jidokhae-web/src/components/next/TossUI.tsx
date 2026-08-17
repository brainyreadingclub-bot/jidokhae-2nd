import Link from 'next/link'

/**
 * next_ui 토스 스킨 공용 조각 (전면개편 스펙 §3).
 * 규칙: 테두리 0(구분은 tg-100 면·여백), radius 14–22, 14px 미만 보조 텍스트는 tg-600 이상.
 * 시각 기준: docs/superpowers/mockups/2026-08-16-토스-전체-18화면.html
 */

/** 섹션 라벨 — "이번 주 할 일" / "정기모임" 등 */
export function Sec({
  children,
  aside,
}: {
  children: React.ReactNode
  aside?: React.ReactNode
}) {
  return (
    <div className="mb-1 mt-6 flex items-baseline justify-between">
      <h3 className="text-[13.5px] font-bold tracking-tight text-tg-600">{children}</h3>
      {aside && <span className="text-xs font-semibold text-tg-500">{aside}</span>}
    </div>
  )
}

/** 흰 카드 — 그림자만으로 뜬다 */
export function BoxWhite({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={`mt-2.5 rounded-[20px] bg-white p-4 ${className}`}
      style={{ boxShadow: 'var(--shadow-toss-card)' }}
    >
      {children}
    </div>
  )
}

/** 회색 면 카드 */
export function BoxGray({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={`mt-2.5 rounded-[18px] bg-tg-100 p-4 ${className}`}>{children}</div>
}

/** 목록 행 — 아이콘 사각 + 제목/보조 + 우측. href 있으면 링크 */
export function RowItem({
  emoji,
  tone = 'green',
  title,
  sub,
  right,
  href,
}: {
  emoji: string
  tone?: 'green' | 'orange' | 'blue' | 'yellow'
  title: string
  sub?: string
  right?: React.ReactNode
  href?: string
}) {
  const toneBg = {
    green: 'bg-brand-bg',
    orange: 'bg-warnx-bg',
    blue: 'bg-[#EDF3FF]',
    yellow: 'bg-[#FFF6E0]',
  }[tone]

  const inner = (
    <>
      <span
        className={`flex h-10 w-10 flex-none items-center justify-center rounded-[13px] text-[17px] ${toneBg}`}
        aria-hidden
      >
        {emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold tracking-tight text-tg-900">
          {title}
        </span>
        {sub && (
          <span className="mt-0.5 block truncate text-xs text-tg-600">{sub}</span>
        )}
      </span>
      {right ?? <Chevron />}
    </>
  )

  const rowClass =
    'flex min-h-[56px] items-center gap-3 border-t border-tg-100 py-3 first:border-t-0'
  return href ? (
    <Link href={href} className={rowClass}>
      {inner}
    </Link>
  ) : (
    <div className={rowClass}>{inner}</div>
  )
}

export function Chevron() {
  return <span className="flex-none text-base text-tg-300" aria-hidden>›</span>
}

/** 주 버튼 — 최소 높이 48px */
export function BtnPrimary({
  children,
  href,
  onClick,
  disabled,
}: {
  children: React.ReactNode
  href?: string
  onClick?: () => void
  disabled?: boolean
}) {
  const cls = `mt-3 flex min-h-[48px] w-full items-center justify-center rounded-[14px] text-sm font-bold tracking-tight ${
    disabled ? 'bg-tg-100 text-tg-400' : 'bg-brand text-white'
  }`
  if (href && !disabled) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    )
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  )
}

/** 보조 버튼 */
export function BtnSoft({
  children,
  href,
  onClick,
}: {
  children: React.ReactNode
  href?: string
  onClick?: () => void
}) {
  const cls =
    'mt-3 flex min-h-[48px] w-full items-center justify-center rounded-[14px] bg-brand-bg text-sm font-bold tracking-tight text-brand-deep'
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    )
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  )
}
