import { createClient } from '@/lib/supabase/server'
import { getKSTToday } from '@/lib/kst'
import { PARTICIPATED_STATUSES } from '@/lib/registration-status'
import { showsFirstVisitGuide, opensFirstVisitGuide } from '@/lib/first-visit'
import type { AttendanceRow } from '@/lib/discussion-eligibility'

/**
 * 「처음 오시나요?」 — 정기모임 상세의 접이식 안내 (서버 컴포넌트, JS 없이 `<details>`로 접고 편다).
 *
 * 🔴 문구의 사실 근거는 정기모임 소개글(prod `meetings.description`, 2026-10-16 조회)뿐이다.
 *    소개글에 없는 약속(누가 맞이한다 · 자리 안내 등)은 쓰지 않는다. 소개글이 바뀌면 여기도 맞춘다.
 *
 * 펼침 판정은 `lib/first-visit.ts` — 정기모임에 다녀온 적이 없는 회원이면 펼친 채로 연다.
 * 조회가 실패하면 접힌 채로 둔다(안내는 부가 기능이라 화면을 깨지 않는다).
 */
export default async function FirstVisitGuide({
  meetingType,
  userId,
}: {
  meetingType: string | null | undefined
  userId: string
}) {
  if (!showsFirstVisitGuide(meetingType)) return null

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('registrations')
    .select('status, meetings(date, meeting_type, status)')
    .eq('user_id', userId)
    .in('status', PARTICIPATED_STATUSES)

  const rows = error ? null : ((data ?? []) as unknown as AttendanceRow[])
  const open = opensFirstVisitGuide(rows, getKSTToday())

  return <FirstVisitGuideView open={open} />
}

/** 표현만 — 미리보기·테스트에서 조회 없이 그릴 수 있게 나눠 둔다 */
export function FirstVisitGuideView({ open }: { open: boolean }) {
  return (
    <details open={open} className="group mt-4 border-t border-tg-100">
      <summary className="flex min-h-[56px] cursor-pointer list-none items-center gap-3 py-3 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1 text-sm font-bold tracking-tight text-tg-900">
          처음 오시나요?
        </span>
        <span
          className="flex-none text-base text-tg-300 transition-transform group-open:rotate-90"
          aria-hidden
        >
          ›
        </span>
      </summary>

      <div className="pb-4">
        <p className="text-[13px] font-bold text-tg-600">진행 순서</p>
        <ol className="mt-1.5 space-y-1.5 text-sm leading-relaxed text-tg-700 break-keep">
          <li>시작 20분 전부터 들어올 수 있어요</li>
          <li>10분 전까지 도착해서 각자 준비한 책을 읽어요</li>
          <li>독서 20분 → 휴식 → 독서 20분 → 휴식 → 생각 나누기 순서로 진행해요</li>
          <li>음료는 모임 5분 전부터 랜덤으로 나와요</li>
        </ol>

        <p className="mt-4 text-[13px] font-bold text-tg-600">준비물</p>
        <p className="mt-1.5 text-sm leading-relaxed text-tg-700 break-keep">
          읽고 싶은 책 한 권. 다 읽은 책이 아니어도 괜찮아요
        </p>
      </div>
    </details>
  )
}
