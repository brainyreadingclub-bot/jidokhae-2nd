import Link from 'next/link'
import { formatKSTDateTime, formatKoreanDate, formatMonthDay } from '@/lib/kst'
import { MOODS, moodLabel, regretLabel, REGRET_OPTIONS } from '@/lib/review-rules'
import type { AdminMeetingReviewDetail } from '@/lib/review-admin'
import ReviewHideButton from '@/components/admin/ReviewHideButton'

/**
 * 운영자 「모임 후기」 한 모임 화면 (시안 A2 · 0건이면 A3) — 표현만. 조회·권한은 page가 한다.
 * 운영자가 내린 소감도 목록에 남긴다 — 사라지면 풀 길이 없어진다(사후 잔재 4시나리오 3번).
 */
export default function AdminMeetingReview({ d }: { d: AdminMeetingReviewDetail }) {
  const { meeting: m, summary: s } = d
  const open = d.window === 'open'
  const empty = s.reviewed === 0 && s.absent === 0
  const maxMood = Math.max(1, ...Object.values(s.moodCounts))
  const maxRegret = Math.max(1, ...s.regretCounts.map((r) => r.count))

  return (
    <div>
      <Link href="/admin/reviews" className="text-[13px] font-semibold text-primary-600 hover:underline">
        ‹ 모임 후기
      </Link>
      <div className="mt-3 flex gap-1.5">
        {m.region && (
          <span className="rounded-full bg-primary-50 px-2.5 py-0.5 text-[11px] font-bold text-primary-700">{m.region}</span>
        )}
        <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-bold text-neutral-700">
          {m.meeting_type === 'regular' ? '정기모임' : '모임'}
        </span>
      </div>
      <h1
        className="mt-2 text-2xl font-extrabold tracking-tight text-primary-900 lg:text-3xl"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {formatKoreanDate(m.date)} {m.region ?? ''} 정기모임
      </h1>
      <p className="mt-1.5 text-sm text-neutral-600 break-keep">
        참여 {s.participants}명 · 후기 {s.reviewed}명
        {!empty && ` · 못 갔어요 ${s.absent}명 · 아직 안 남김 ${s.notYet}명`} ·{' '}
        <b className={open ? 'text-primary-600' : 'text-neutral-700'}>
          {open ? `${formatMonthDay(d.deadline)}까지 받는 중` : d.window === 'before' ? '아직 받기 전' : '마감'}
        </b>
      </p>

      {empty ? (
        <div className="mt-7 rounded-[var(--radius-lg)] border border-dashed border-neutral-300 px-6 py-9 text-center">
          <b className="text-[15px] font-extrabold text-neutral-800">아직 남긴 후기가 없어요</b>
          <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-600 break-keep">
            {d.reviewNoticeSentAt
              ? `알림톡은 ${formatKSTDateTime(d.reviewNoticeSentAt)}에 처음 나갔다. `
              : '이 모임에는 후기 알림톡이 나간 기록이 없다. '}
            받는 기간이 끝나면 이 모임은 「마감」으로 바뀐다.
          </p>
        </div>
      ) : (
        <div className="mt-7 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-[var(--radius-lg)] border border-neutral-200 bg-white px-[22px] py-5">
            <h3 className="text-sm font-extrabold text-neutral-900">표정</h3>
            <p className="mt-0.5 text-[12.5px] text-neutral-500">후기를 남긴 {s.reviewed}명</p>
            <p className="mt-2.5 flex items-baseline gap-2">
              <b className="text-[28px] font-extrabold tracking-[-0.03em]">{s.moodAvg === null ? '—' : s.moodAvg.toFixed(1)}</b>
              <span className="text-[13px] text-neutral-600">/ 5</span>
            </p>
            <div className="mt-3.5">
              {[...MOODS].reverse().map((mo) => {
                const n = s.moodCounts[mo.value as 1 | 2 | 3 | 4 | 5]
                return (
                  <Bar
                    key={mo.value}
                    label={mo.label}
                    n={n}
                    pct={(n / maxMood) * 100}
                    tone={mo.value >= 4 ? 'brand' : 'gray'}
                  />
                )
              })}
            </div>
          </div>
          <div className="rounded-[var(--radius-lg)] border border-neutral-200 bg-white px-[22px] py-5">
            <h3 className="text-sm font-extrabold text-neutral-900">무엇이 아쉬웠나요</h3>
            <p className="mt-0.5 text-[12.5px] text-neutral-500">
              낮은 표정을 고른 {s.lowCount}명 · 여러 개 고를 수 있음
            </p>
            {s.regretCounts.length === 0 ? (
              <p className="mt-5 text-[13px] text-neutral-500">고른 아쉬운 점이 없다.</p>
            ) : (
              <div className="mt-5">
                {s.regretCounts.map((r) => (
                  <Bar key={r.code} label={regretLabel(r.code)} n={r.count} pct={(r.count / maxRegret) * 100} wide />
                ))}
              </div>
            )}
            {s.regretCounts.length > 0 && s.regretCounts.length < REGRET_OPTIONS.length && (
              <p className="mt-3.5 text-[12.5px] text-neutral-500">나머지 선택지는 0건이라 접어 둠</p>
            )}
            {d.regretOthers.length > 0 && (
              <div className="mt-3.5 border-t border-neutral-100 pt-3">
                <p className="text-xs font-bold text-neutral-600">「기타」에 쓴 말</p>
                <ul className="mt-1.5 space-y-1 text-[13px] text-neutral-800">
                  {d.regretOthers.map((t, i) => (
                    <li key={i} className="break-keep">· {t}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      <section className="mt-10">
        <SecHead
          title="첫 모임 회원"
          count={`${d.firstTimers.length}명`}
          hint={`재신청 기한 = 모임 14일 뒤(${formatMonthDay(d.rereDeadline)})까지 · 취소한 신청도 신청으로 센다 · DB 기록 기준`}
        />
        {d.firstTimers.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">이 모임이 첫 정기모임인 회원이 없다.</p>
        ) : (
          <>
            {/* 모바일 카드 목록 — 표는 폭이 모자라 닉네임·표정이 세로로 쪼개졌다(390 실측) */}
            <ul className="mt-3 space-y-2 md:hidden">
              {d.firstTimers.map((f) => (
                <li key={f.userId} className="rounded-[var(--radius-md)] border border-neutral-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-bold text-neutral-900">{f.nickname}</span>
                    <span className={`flex-none text-[13px] ${firstTimerMoodTone(f)}`}>{firstTimerMoodText(f)}</span>
                  </div>
                  <p className={`mt-1.5 text-[13px] break-keep ${f.regretCodes.length ? 'text-neutral-700' : 'text-neutral-400'}`}>
                    아쉬운 점 · {f.regretCodes.length ? f.regretCodes.map(regretLabel).join(' · ') : '—'}
                  </p>
                  {f.comment && <p className="mt-1 text-[13px] leading-relaxed text-neutral-900 break-keep">{f.comment}</p>}
                  <p className="mt-1.5 text-xs">
                    <span className="text-neutral-500">14일 안 재신청 · </span>
                    <ReregText r={f.rereg} />
                  </p>
                </li>
              ))}
            </ul>
            <div className="mt-3 hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] border-collapse text-[13.5px]">
                <thead>
                  <tr className="border-b border-neutral-300 text-left text-xs font-bold text-neutral-600">
                    <th className="px-3 py-2.5">닉네임</th>
                    <th className="px-3 py-2.5">표정</th>
                    <th className="px-3 py-2.5">아쉬운 점</th>
                    <th className="px-3 py-2.5">한 줄 소감</th>
                    <th className="px-3 py-2.5">14일 안 재신청</th>
                  </tr>
                </thead>
                <tbody>
                  {d.firstTimers.map((f) => (
                    <tr key={f.userId} className="border-b border-neutral-100 align-top">
                      <td className="px-3 py-3 font-bold text-neutral-900">{f.nickname}</td>
                      <td className={`px-3 py-3 ${firstTimerMoodTone(f)}`}>{firstTimerMoodText(f)}</td>
                      <td className={`px-3 py-3 ${f.regretCodes.length ? '' : 'text-neutral-400'}`}>
                        {f.regretCodes.length ? f.regretCodes.map(regretLabel).join(' · ') : '—'}
                      </td>
                      <td className={`px-3 py-3 break-keep ${f.comment ? '' : 'text-neutral-400'}`}>{f.comment ?? '—'}</td>
                      <td className="px-3 py-3">
                        <ReregText r={f.rereg} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {d.comments.length > 0 && (
        <section className="mt-10">
          <SecHead
            title="한 줄 소감"
            count={`${d.comments.length}개`}
            hint="공개 = 회원이 「모임 소개에 공개해도 좋아요」를 켠 것 · 운영자가 내린 소감은 회원이 다시 공개할 수 없다"
          />
          {/* 모바일 카드 목록 — 상태와 「내리기」를 한 줄에 가로로 (표에선 버튼이 세로로 깨졌다, 390 실측) */}
          <ul className="mt-3 space-y-2 md:hidden">
            {d.comments.map((c) => (
              <li key={c.id} className="rounded-[var(--radius-md)] border border-neutral-200 bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 truncate text-sm font-bold text-neutral-900">{c.nickname}</span>
                  <span className="flex-none text-[13px] text-neutral-700">{moodLabel(c.mood)}</span>
                </div>
                <p className="mt-1.5 text-[14px] leading-relaxed text-neutral-900 break-keep">{c.comment}</p>
                <div className="mt-2.5 flex min-h-8 items-center justify-between gap-3">
                  <span className="min-w-0 text-xs font-bold">
                    <CommentStateText c={c} />
                  </span>
                  <CommentAction c={c} />
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-3 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[760px] border-collapse text-[13.5px]">
              <thead>
                <tr className="border-b border-neutral-300 text-left text-xs font-bold text-neutral-600">
                  <th className="px-3 py-2.5">닉네임</th>
                  <th className="px-3 py-2.5">표정</th>
                  <th className="px-3 py-2.5">소감</th>
                  <th className="px-3 py-2.5">공개</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {d.comments.map((c) => (
                  <tr key={c.id} className="border-b border-neutral-100 align-top">
                    <td className="px-3 py-3 font-bold text-neutral-900">{c.nickname}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{moodLabel(c.mood)}</td>
                    <td className="w-[52%] px-3 py-3 leading-relaxed text-neutral-900 break-keep">{c.comment}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-xs font-bold">
                      <CommentStateText c={c} />
                    </td>
                    <td className="px-3 py-3 text-right">
                      <CommentAction c={c} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <p className="mt-7 text-[12.5px] text-neutral-500">칭찬은 이 화면에 없다 — 받은 사람만 본다.</p>
    </div>
  )
}

type FirstTimer = AdminMeetingReviewDetail['firstTimers'][number]
type CommentRow = AdminMeetingReviewDetail['comments'][number]

function firstTimerMoodText(f: FirstTimer): string {
  return f.didNotAttend ? '못 갔어요' : f.mood === null ? '안 남김' : moodLabel(f.mood)
}

function firstTimerMoodTone(f: FirstTimer): string {
  return f.mood === null ? 'text-neutral-400' : f.mood <= 2 ? 'font-extrabold text-neutral-900' : ''
}

function ReregText({ r }: { r: FirstTimer['rereg'] }) {
  if (r.kind === 'yes') {
    return (
      <span className="font-bold text-primary-600">
        했어요 · {formatMonthDay(r.meetingDate)} {r.region ?? ''}
      </span>
    )
  }
  if (r.kind === 'pending') {
    return <span>아직 · {r.daysLeft === 0 ? '오늘까지' : `${r.daysLeft}일 남음`}</span>
  }
  return <span className="text-neutral-500">안 했어요</span>
}

function CommentStateText({ c }: { c: CommentRow }) {
  if (c.state === 'public') return <span className="text-primary-600">공개 중</span>
  if (c.state === 'admin_hidden') {
    return (
      <span className="text-neutral-700">
        운영자가 내림{c.hiddenAt ? ` · ${formatKSTDateTime(c.hiddenAt)}` : ''}
      </span>
    )
  }
  if (c.state === 'member_unpublished') {
    return (
      <span className="text-neutral-500">
        회원이 내림{c.unpublishedAt ? ` · ${formatKSTDateTime(c.unpublishedAt)}` : ''}
      </span>
    )
  }
  return <span className="text-neutral-500">운영자만</span>
}

function CommentAction({ c }: { c: CommentRow }) {
  if (c.state === 'public') return <ReviewHideButton reviewId={c.id} nickname={c.nickname} action="hide" />
  if (c.state === 'admin_hidden') return <ReviewHideButton reviewId={c.id} nickname={c.nickname} action="unhide" />
  return null
}

function SecHead({ title, count, hint }: { title: string; count: string; hint: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3">
      <h2 className="text-[17px] font-extrabold tracking-tight text-neutral-900">
        {title}
        <span className="ml-1.5 text-sm font-semibold text-neutral-600">{count}</span>
      </h2>
      <span className="text-[12.5px] text-neutral-500 break-keep">{hint}</span>
    </div>
  )
}

function Bar({
  label,
  n,
  pct,
  tone = 'gray',
  wide = false,
}: {
  label: string
  n: number
  pct: number
  tone?: 'brand' | 'gray'
  wide?: boolean
}) {
  return (
    <div
      className="grid h-[30px] items-center gap-3 text-[13px]"
      style={{ gridTemplateColumns: `${wide ? '180px' : '86px'} 1fr 34px` }}
    >
      <span className="truncate text-neutral-700">{label}</span>
      <span className="h-2 overflow-hidden rounded-full bg-neutral-100">
        <i
          className={`block h-full rounded-full ${tone === 'brand' ? 'bg-primary-500' : 'bg-neutral-400'}`}
          style={{ width: `${n === 0 ? 0 : Math.max(4, pct)}%` }}
        />
      </span>
      <span className={`text-right font-bold tabular-nums ${n === 0 ? 'text-neutral-400' : ''}`}>{n}</span>
    </div>
  )
}
