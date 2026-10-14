import Link from 'next/link'

/**
 * 없는 모임·지워진 모임 주소 (알림톡의 옛 링크로 들어오는 경우가 많다).
 * 홈보다 모임 목록이 다음 행동에 가깝다 — 다른 일정을 바로 고를 수 있게.
 */
export default function MeetingNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-tg-100 text-[22px]" aria-hidden>
        🔍
      </div>
      <h2 className="mt-4 text-[17px] font-extrabold tracking-tight text-tg-900">
        모임을 찾을 수 없어요
      </h2>
      <p className="mt-1.5 text-[13px] text-tg-600">취소됐거나 주소가 잘못된 모임이에요</p>
      <Link
        href="/meet"
        className="mt-5 flex min-h-[48px] min-w-[160px] items-center justify-center rounded-[14px] bg-brand px-6 text-sm font-bold text-white"
      >
        모임 목록 보기
      </Link>
    </div>
  )
}
