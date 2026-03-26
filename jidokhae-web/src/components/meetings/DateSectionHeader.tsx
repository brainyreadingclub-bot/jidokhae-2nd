import { formatKoreanDateFull, getDaysUntil } from '@/lib/kst'

type Props = {
  date: string
  kstToday: string
}

export default function DateSectionHeader({ date, kstToday }: Props) {
  const daysUntil = getDaysUntil(date, kstToday)

  const badgeText =
    daysUntil === 0
      ? '오늘'
      : daysUntil === 1
        ? '내일'
        : daysUntil > 0
          ? `D-${daysUntil}`
          : null

  const badgeColor =
    daysUntil === 0
      ? 'bg-accent-50 text-accent-600 border-accent-200'
      : daysUntil === 1
        ? 'bg-primary-50 text-primary-600 border-primary-200'
        : 'bg-neutral-100 text-neutral-500 border-neutral-200'

  return (
    <div className="flex items-center gap-2.5 pt-1 pb-2">
      <span className="text-[13px] font-bold text-primary-700">
        {formatKoreanDateFull(date)}
      </span>
      {badgeText && (
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${badgeColor}`}>
          {badgeText}
        </span>
      )}
      <span className="flex-1 h-px bg-neutral-200" />
    </div>
  )
}
