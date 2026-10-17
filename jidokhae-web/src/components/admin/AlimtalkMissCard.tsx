import { formatKSTDateTime, formatMonthDay, shiftDate } from '@/lib/kst'
import {
  MISS_KIND_LABELS,
  MISS_REASON_LABELS,
  missHeadline,
  type MeetingMissReport,
  type MissItem,
} from '@/lib/alimtalk-miss'

/**
 * 운영자 모임 상세 — 「알림톡 못 받은 회원」 (2026-10-17, 목표 4).
 * 발송 이력이 아니라 **못 받은 사람 명단**이다. 다 받았으면 한 줄로 끝난다.
 * 다시 보내기 버튼은 두지 않는다 — 중복 막기 장치가 같은 알림을 다시 못 보내게 해서
 * 「눌렀는데 아무 일 없음」이 된다(2026-07-30 검토). 운영자는 카톡·문자로 따로 알린다.
 * 전화번호는 총괄만 — 운영진 화면에는 값이 아예 오지 않는다(`registrantProfileColumns`).
 */
export default function AlimtalkMissCard({
  report,
  meetingDate,
  isAdmin,
}: {
  /** null = 알림 기록을 못 읽었다. 「다 갔어요」라고 말하지 않는다 */
  report: MeetingMissReport | null
  meetingDate: string
  isAdmin: boolean
}) {
  if (!report) {
    return (
      <section className={`${card} border-surface-300 bg-white`}>
        <div className={label}>알림톡</div>
        <p className="mt-1.5 text-[13px] text-neutral-600">알림톡 기록을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.</p>
      </section>
    )
  }

  const remindLine = remindText(report, meetingDate)
  const hasMiss = report.missedPeople > 0

  if (!hasMiss) {
    return (
      <section className={`${card} border-surface-300 bg-white`}>
        <div className={label}>알림톡</div>
        <p className="mt-1.5 text-sm font-bold text-neutral-900">
          {report.participants > 0 ? '보낼 알림은 모두 갔어요' : '아직 신청자가 없어요'}
        </p>
        <p className={`mt-1 text-[13px] ${remindLine.alert ? 'font-bold text-accent-600' : 'text-neutral-600'}`}>
          {remindLine.text}
        </p>
      </section>
    )
  }

  // 사람별로 묶는다 — 한 사람이 신청 안내·전날 안내를 둘 다 못 받았으면 한 줄에
  const byPerson = new Map<string, MissItem[]>()
  for (const item of report.items) {
    const list = byPerson.get(item.userId) ?? []
    list.push(item)
    byPerson.set(item.userId, list)
  }

  return (
    <section className={`${card} border-accent-200`} style={{ backgroundColor: 'var(--color-accent-50)' }}>
      <div className={`${label} text-accent-700`}>알림톡</div>
      <p className="mt-1.5 text-[15px] font-extrabold tracking-tight text-accent-700">{missHeadline(report)}</p>
      <p className="mt-1 text-[13px] text-neutral-600">카톡이나 문자로 따로 알려 주세요.</p>

      <ul className="mt-3 divide-y divide-accent-100 rounded-[var(--radius-md)] border border-accent-100 bg-white">
        {Array.from(byPerson.values()).map((items) => {
          const who = items[0]
          return (
            <li key={who.userId} className="flex items-start justify-between gap-3 px-3.5 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-neutral-900">
                  {who.nickname || '(닉네임 없음)'}
                  {who.realName && <span className="ml-1 font-medium text-neutral-500">{who.realName}</span>}
                </div>
                <div className="mt-0.5 text-[12px] text-neutral-600">
                  {items.map((i) => `${MISS_KIND_LABELS[i.kind]} · ${MISS_REASON_LABELS[i.reason]}`).join('  /  ')}
                </div>
              </div>
              {isAdmin && who.phone && (
                <a
                  href={`tel:${who.phone}`}
                  className="flex-none whitespace-nowrap text-[13px] font-semibold tabular-nums text-primary-700 underline"
                >
                  {who.phone}
                </a>
              )}
            </li>
          )
        })}
      </ul>

      <p className={`mt-3 text-[12px] ${remindLine.alert ? 'font-bold text-accent-600' : 'text-neutral-500'}`}>
        {remindLine.text}
      </p>
    </section>
  )
}

function remindText(report: MeetingMissReport, meetingDate: string): { text: string; alert: boolean } {
  switch (report.remind.state) {
    case 'not_yet':
      return { text: `전날 안내는 ${formatMonthDay(shiftDate(meetingDate, -1))} 저녁 7시에 나가요`, alert: false }
    case 'ran':
      return {
        text: `전날 안내 점검 ${formatKSTDateTime(report.remind.ranAt)} · 대상 ${report.remind.targets}명`,
        alert: false,
      }
    case 'missing':
      return { text: '전날 안내가 나간 기록이 없어요', alert: true }
  }
}

/** 테두리 색은 쓰는 쪽이 붙인다 — 같은 칸에 색 두 개를 겹치면 어느 쪽이 이길지 모른다 */
const card = 'mt-3 rounded-[var(--radius-lg)] border px-[18px] py-4 lg:px-[22px] lg:py-5'
const label = 'text-[13px] font-bold text-neutral-700'
