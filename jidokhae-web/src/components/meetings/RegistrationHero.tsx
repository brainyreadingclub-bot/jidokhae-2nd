import { formatDDay } from '@/lib/kst'

type Props = {
  nickname: string
  meetingDate: string
  meetingTime: string
  kstToday: string
}

export default function RegistrationHero({ nickname, meetingDate, meetingTime, kstToday }: Props) {
  const dDay = formatDDay(meetingDate, meetingTime, kstToday)

  // 날짜 본문: "5/17(토)"
  const [, mm, dd] = meetingDate.split('-')
  const date = new Date(meetingDate + 'T12:00:00+09:00')
  const dow = ['일', '월', '화', '수', '목', '금', '토'][date.getUTCDay()]
  const shortDate = `${Number(mm)}/${Number(dd)}(${dow})`

  const greeting = nickname || '회원'

  return (
    <div
      className="mx-5 mt-4 flex items-center gap-3.5 rounded-[var(--radius-lg)] px-5 py-4 text-white"
      style={{
        background: 'linear-gradient(135deg, var(--color-primary-500), var(--color-primary-600))',
        boxShadow: '0 8px 20px rgba(45, 125, 95, 0.25)',
      }}
    >
      <div
        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full"
        style={{ background: 'rgba(255,255,255,0.18)' }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold tracking-tight">신청 완료한 모임이에요</p>
        <p className="mt-0.5 text-xs opacity-90 tracking-tight">
          {dDay && (
            <span
              className="mr-1.5 inline-block rounded px-1.5 py-px text-[11px] font-bold"
              style={{ background: 'rgba(255,255,255,0.22)' }}
            >
              {dDay}
            </span>
          )}
          {greeting}님, {shortDate} 만나요
        </p>
      </div>
    </div>
  )
}
