import Link from 'next/link'
import { formatKoreanDate, formatMonthDay } from '@/lib/kst'
import { regretLabel } from '@/lib/review-rules'
import type { AdminReviewOverview } from '@/lib/review-admin'

/** 운영자 「모임 후기」 목록 화면 (시안 A1) — 표현만. 조회·권한은 page가 한다 */
export default function AdminReviewList({
  overview,
  region,
  enabled,
  rangeDays,
}: {
  overview: AdminReviewOverview
  region: string | null
  enabled: boolean
  rangeDays: number
}) {
  const { rows, regions, kpi } = overview
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-500">운영</div>
          <h1
            className="mt-1 text-2xl font-extrabold tracking-tight text-primary-900 lg:text-3xl"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            모임 후기
          </h1>
          <p className="mt-1 text-sm text-neutral-500 break-keep">
            정기모임 다음 날 알림톡으로 받는다. 표정·아쉬운 점은 총괄운영자만 본다(이 메뉴는 admin 전용).
            {!enabled && ' 지금은 회원 화면이 꺼져 있다(review_enabled).'}
          </p>
        </div>
        <nav className="flex flex-wrap gap-1.5" aria-label="지역">
          <RegionTab href="/admin/reviews" on={!region}>
            전체
          </RegionTab>
          {regions.map((r) => (
            <RegionTab key={r} href={`/admin/reviews?region=${encodeURIComponent(r)}`} on={region === r}>
              {r}
            </RegionTab>
          ))}
          <span className="inline-flex h-[34px] items-center rounded-[9px] border border-neutral-200 bg-white px-3.5 text-[13px] font-semibold text-neutral-600">
            최근 {rangeDays}일
          </span>
        </nav>
      </div>

      <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Kpi
          label="표정 평균"
          big={kpi.moodAvg === null ? '—' : kpi.moodAvg.toFixed(1)}
          unit={kpi.moodAvg === null ? undefined : '/ 5'}
          sub="후기를 남긴 사람 기준 · 「못 갔어요」 제외"
        />
        <Kpi
          label="후기 남긴 비율"
          big={String(kpi.reviewed)}
          unit={`/ ${kpi.participants}명`}
          sub="참여(확정 + 입금 대기) 중 표정을 고른 사람"
        />
        <Kpi
          label="첫 모임 회원 · 14일 안 재신청"
          big={String(kpi.reregistered)}
          unit={`/ ${kpi.firstTimers}명`}
          sub="재신청한 사람 ÷ 첫 모임 회원 · 기한이 남은 사람 포함 · DB 기록 기준"
        />
      </div>

      <section className="mt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-[17px] font-extrabold tracking-tight text-neutral-900">
            모임별<span className="ml-1.5 text-sm font-semibold text-neutral-600">{rows.length}건</span>
          </h2>
          <span className="text-[12.5px] text-neutral-500">모임을 누르면 그 모임 후기로</span>
        </div>

        {rows.length === 0 ? (
          <p className="mt-4 rounded-[var(--radius-md)] border border-dashed border-neutral-300 px-6 py-8 text-center text-sm text-neutral-600">
            최근 {rangeDays}일 안에 열린 정기모임이 없다.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-[13.5px]">
              <thead>
                <tr className="border-b border-neutral-300 text-left text-xs font-bold text-neutral-600">
                  <th className="px-3 py-2.5">모임</th>
                  <th className="px-3 py-2.5">받는 기간</th>
                  <th className="px-3 py-2.5 text-right">참여</th>
                  <th className="px-3 py-2.5 text-right">후기</th>
                  <th className="px-3 py-2.5 text-right">못 갔어요</th>
                  <th className="px-3 py-2.5 text-right">표정 평균</th>
                  <th className="px-3 py-2.5 text-right">낮은 표정</th>
                  <th className="px-3 py-2.5">많이 나온 아쉬운 점</th>
                  <th className="px-3 py-2.5 text-right">첫 모임</th>
                  <th className="px-3 py-2.5 text-right">공개 소감</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ meeting: m, window, deadline, summary: s, firstTimers, publicComments }) => (
                  <tr key={m.id} className="border-b border-neutral-100 align-top">
                    <td className="px-3 py-3">
                      <Link href={`/admin/reviews/${m.id}`} className="font-bold text-primary-700 hover:underline">
                        {formatKoreanDate(m.date)} {m.region ?? ''} 정기모임
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                          window === 'open' ? 'bg-primary-50 text-primary-700' : 'bg-neutral-100 text-neutral-700'
                        }`}
                      >
                        {window === 'open' ? `${formatMonthDay(deadline)}까지` : '마감'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{s.participants}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{s.reviewed}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{s.absent}</td>
                    <td className={`px-3 py-3 text-right tabular-nums ${s.moodAvg === null ? 'text-neutral-400' : ''}`}>
                      {s.moodAvg === null ? '—' : s.moodAvg.toFixed(1)}
                    </td>
                    {/* 낮은 표정 강조는 굵은 글씨 — 코럴은 에러·긴급에만 (시안 자가검토) */}
                    <td className={`px-3 py-3 text-right tabular-nums ${s.lowCount > 0 ? 'font-extrabold text-neutral-900' : ''}`}>
                      {s.lowCount}
                    </td>
                    <td className={`px-3 py-3 ${s.regretCounts[0] ? '' : 'text-neutral-400'}`}>
                      {s.regretCounts[0] ? regretLabel(s.regretCounts[0].code) : '—'}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{firstTimers}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{publicComments}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-6 text-[12.5px] text-neutral-500 break-keep">
          낮은 표정 = 「별로였어요」·「아쉬웠어요」. 칭찬은 받은 사람만 보고, 운영자 화면에도 개수를 두지 않는다.
        </p>
      </section>
    </div>
  )
}

function RegionTab({ href, on, children }: { href: string; on: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`inline-flex h-[34px] items-center rounded-[9px] border px-3.5 text-[13px] font-semibold ${
        on ? 'border-primary-600 bg-primary-600 text-white' : 'border-neutral-200 bg-white text-neutral-700'
      }`}
    >
      {children}
    </Link>
  )
}

function Kpi({ label, big, unit, sub }: { label: string; big: string; unit?: string; sub: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-neutral-200 bg-white px-5 py-[18px]">
      <p className="text-[13px] font-bold text-neutral-700">{label}</p>
      <p className="mt-1.5 text-[30px] font-extrabold leading-[1.1] tracking-[-0.03em] tabular-nums text-neutral-900">
        {big} {unit && <small className="text-[17px] font-bold text-neutral-500">{unit}</small>}
      </p>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-neutral-600 break-keep">{sub}</p>
    </div>
  )
}
