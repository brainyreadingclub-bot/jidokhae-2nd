/**
 * 토스 스킨 정보 상자 — 라벨/값 두 칸, 테두리 0(헤어라인 tg-200만).
 * 시안 06 「정기모임 상세」·07 「신청 확인」·09 「토론모임 상세」가 같은 모양을 쓴다.
 */

export type InfoRow = {
  label: string
  value: string
  /** 값 아래 한 줄 (스텝 할인 안내 등) */
  sub?: string
  subTone?: 'brand' | 'muted'
}

export default function MeetingInfoRows({ rows }: { rows: InfoRow[] }) {
  return (
    <div className="mt-3 rounded-[18px] bg-tg-100 px-4">
      {rows.map((r, i) => (
        <div
          key={r.label}
          className={`flex items-start gap-4 py-3.5 ${i > 0 ? 'border-t border-tg-200' : ''}`}
        >
          <span className="w-14 flex-none text-[13px] font-semibold text-tg-600">{r.label}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-bold tracking-tight text-tg-900 break-keep">
              {r.value}
            </span>
            {r.sub && (
              <span
                className={`mt-0.5 block text-xs font-semibold ${
                  r.subTone === 'brand' ? 'text-brand-deep' : 'text-tg-600'
                }`}
              >
                {r.sub}
              </span>
            )}
          </span>
        </div>
      ))}
    </div>
  )
}
