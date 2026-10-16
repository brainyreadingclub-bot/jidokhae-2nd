import Link from 'next/link'

/**
 * 모임 후기 화면 조각 (시안 `docs/시안-공유/2026-10-12-모임후기/회원.html`).
 * 토스 스킨 토큰만 쓴다 — 새 토큰 없음.
 */

/** 흐름 머리 — 뒤로 · 「모임 후기」 · 「1 / 3」 + 진행 막대 */
export function FlowHeader({
  title,
  onBack,
  backHref,
  step,
}: {
  title: string
  onBack?: () => void
  backHref?: string
  step?: { index: number; total: number }
}) {
  const chevron = (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
      <path d="m15 18-6-6 6-6" />
    </svg>
  )
  const backCls = 'flex h-11 w-11 -ml-3 flex-none items-center justify-center text-tg-800'
  return (
    <div>
      <div className="flex h-[52px] items-center gap-1">
        {onBack ? (
          <button type="button" onClick={onBack} className={backCls} aria-label="뒤로">
            {chevron}
          </button>
        ) : backHref ? (
          <Link href={backHref} className={backCls} aria-label="뒤로">
            {chevron}
          </Link>
        ) : null}
        <span className="flex-1 text-base font-bold tracking-tight text-tg-900">{title}</span>
        {step && (
          <span className="pr-1 text-[13px] font-bold tabular-nums text-tg-500">
            {step.index + 1} / {step.total}
          </span>
        )}
      </div>
      {step && (
        <div className="h-[3px] overflow-hidden rounded-[3px] bg-tg-100">
          <i
            className="block h-full rounded-[3px] bg-brand transition-[width] duration-200"
            style={{ width: `${((step.index + 1) / step.total) * 100}%` }}
          />
        </div>
      )}
    </div>
  )
}

/** 하단 고정 버튼 자리 — 5탭 내비 위에 뜬다 (모임 상세 신청 버튼과 같은 자리) */
export function FootBar({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40"
      style={{ paddingBottom: 'calc(56px + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="mx-auto max-w-screen-sm bg-white px-5 pb-3 pt-2.5">{children}</div>
    </div>
  )
}

/** 주 버튼. tone: brand(기본) · soft(회색) · off(꺼짐) */
export function Cta({
  children,
  onClick,
  href,
  disabled,
  tone = 'brand',
}: {
  children: React.ReactNode
  onClick?: () => void
  href?: string
  disabled?: boolean
  tone?: 'brand' | 'soft'
}) {
  const cls = `flex min-h-[52px] w-full items-center justify-center rounded-[14px] text-[15px] font-extrabold tracking-tight ${
    disabled ? 'bg-tg-100 text-tg-400' : tone === 'soft' ? 'bg-tg-100 text-tg-700' : 'bg-brand text-white'
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

/** 버튼 아래 글자 버튼 — 「건너뛰기」 · 「홈으로」 */
export function SkipButton({
  children,
  onClick,
  href,
  disabled,
}: {
  children: React.ReactNode
  onClick?: () => void
  href?: string
  disabled?: boolean
}) {
  const cls = 'mt-1 flex min-h-[44px] w-full items-center justify-center text-sm font-bold text-tg-600 disabled:opacity-50'
  if (href) {
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

/** 저장 실패 한 줄 — 코럴은 에러에만 (시안 13) */
export function SaveError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="mb-2.5 flex items-start gap-2 text-[13px] font-semibold leading-relaxed text-warnx">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="mt-0.5 flex-none" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5M12 16.5v.5" />
      </svg>
      <span>{children}</span>
    </p>
  )
}

/** 마침 표시 동그라미 — muted면 회색(「못 갔어요」) */
export function DoneIcon({ muted = false }: { muted?: boolean }) {
  return (
    <div
      className={`mt-14 flex h-14 w-14 items-center justify-center rounded-full ${muted ? 'bg-tg-100' : 'bg-brand'}`}
      aria-hidden
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={muted ? '#6B7684' : '#fff'} strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </div>
  )
}

/** 질문 제목 · 보조 */
export function Question({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="mt-[22px] text-[23px] font-extrabold leading-[1.36] tracking-[-0.03em] text-tg-900 break-keep">
      {children}
    </h1>
  )
}

export function QuestionSub({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-sm leading-relaxed text-tg-600 break-keep">{children}</p>
}

/** 남긴 것 요약 행 (시안 10·11) */
export function SummaryRow({
  label,
  value,
  sub,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
}) {
  return (
    <div className="flex gap-3.5 border-t border-tg-100 py-3.5 first:border-t-0">
      <span className="w-[76px] flex-none text-sm text-tg-600">{label}</span>
      <span className="min-w-0 flex-1 text-sm font-semibold leading-relaxed text-tg-900 break-keep">
        {value}
        {sub && <small className="mt-0.5 block text-[12.5px] font-medium text-tg-600">{sub}</small>}
      </span>
    </div>
  )
}
