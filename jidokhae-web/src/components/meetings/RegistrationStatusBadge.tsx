type RegistrationStatusBadgeProps = {
  status: 'confirmed' | 'pending_transfer' | 'waitlisted' | null
}

const STATUS_BADGE = {
  confirmed: {
    label: '신청완료',
    classes: 'bg-accent-50 text-accent-700 border-accent-200',
  },
  pending_transfer: {
    label: '입금대기',
    classes: 'bg-accent-50 text-accent-600 border-accent-200',
  },
  waitlisted: {
    label: '대기 중',
    classes: 'bg-accent-50 text-accent-600 border-accent-200',
  },
} as const

export default function RegistrationStatusBadge({ status }: RegistrationStatusBadgeProps) {
  if (!status) return null

  const badge = STATUS_BADGE[status]

  return (
    <div className="mt-4">
      <span
        className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${badge.classes}`}
      >
        {badge.label}
      </span>
    </div>
  )
}
