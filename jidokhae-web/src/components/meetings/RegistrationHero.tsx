import { formatDDay, getDaysUntil } from '@/lib/kst'

type Props = {
  nickname: string
  meetingDate: string
  meetingTime: string
  kstToday: string
  isPending?: boolean
}

/**
 * 모임 상세 — 신청 완료 inline strip.
 * confirmed / pending_transfer 모두 동일 컴포넌트로 렌더한다.
 * (pending_transfer의 입금 안내는 본문 안내 박스에서 별도 처리)
 *
 * 디자인 원칙: banner가 아닌 inline indicator (Refactoring UI · Apple HIG).
 * 높이 ~40px, primary-50 배경 + primary-200 border, 그림자 없음.
 */
export default function RegistrationHero({ nickname, meetingDate, meetingTime, kstToday, isPending = false }: Props) {
  const dDay = formatDDay(meetingDate, meetingTime, kstToday)
  const days = getDaysUntil(meetingDate, kstToday)
  // D-3 이하 (오늘·내일 포함)면 긴급 톤
  const isUrgent = days >= 0 && days <= 3

  // 짧은 날짜: "5/13(수)"
  const [, mm, dd] = meetingDate.split('-')
  const date = new Date(meetingDate + 'T12:00:00+09:00')
  const dow = ['일', '월', '화', '수', '목', '금', '토'][date.getUTCDay()]
  const shortDate = `${Number(mm)}/${Number(dd)}(${dow})`

  const greeting = nickname || '회원'

  return (
    <div
      className="mt-2 mb-6 flex items-center gap-2.5 rounded-[var(--radius-md)] px-3.5 py-2.5"
      style={{
        backgroundColor: 'var(--color-primary-50)',
        border: '1px solid var(--color-primary-200)',
      }}
    >
      <span
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-white"
        style={{ backgroundColor: 'var(--color-primary-500)' }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
      <span className="text-[13px] font-bold tracking-tight text-primary-800">
        {isPending ? '신청 접수됨' : '신청 완료'}
      </span>
      <span className="text-xs text-primary-600 tracking-tight">
        {greeting}님, {shortDate} 만나요
      </span>
      {dDay && (
        <span
          className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold tracking-tight ${
            isUrgent
              ? 'bg-accent-500 text-white'
              : 'bg-primary-100 text-primary-700'
          }`}
        >
          {dDay}
        </span>
      )}
    </div>
  )
}
