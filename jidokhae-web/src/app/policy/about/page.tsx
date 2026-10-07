import Link from 'next/link'
import type { Metadata } from 'next'
import { getSiteSettings } from '@/lib/site-settings'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: '서비스 소개 | 지독해',
  description: '경주·포항 독서모임 지독해 — 일정 확인부터 신청, 결제까지 한 곳에서',
}

export default async function AboutPage() {
  const supabase = await createClient()
  const [settings, { data: memberCount }] = await Promise.all([
    getSiteSettings(),
    // 손으로 적는 site_settings.member_count 대신 실제 가입자를 센다.
    // 그 값은 256이었고 실제 가입자는 166이라 로그인 화면과 숫자가 갈려 있었다
    // — 같은 앱이 두 숫자를 말하는 자리가 **비로그인도 보는 첫 화면**이었다.
    // 로그인 화면(auth/login/page.tsx)이 쓰던 RPC를 그대로 쓴다. 새로 만들지 않았다.
    supabase.rpc('get_member_count'),
  ])
  const regionsLabel = settings['active_regions_label'] ?? '경주 · 포항'
  // 지역이 셋이 되자 기존 `.replace(' · ', '와 ')`가 첫 구분자만 바꿔
  // "경주와 포항 · 대구에서"라는 문장을 만들었다 (2026-10-07 렌더 실측).
  // 둘일 때만 "A와 B", 그 외는 쉼표로 잇는다 — 지역이 더 늘어도 안 깨진다.
  const regions = regionsLabel.split('·').map((r) => r.trim()).filter(Boolean)
  const regionsPhrase = regions.length === 2 ? regions.join('와 ') : regions.join(', ')
  return (
    <div className="flex min-h-screen flex-col">
      {/* ── Hero Section ── */}
      <section
        className="relative overflow-hidden px-[var(--spacing-page)] pb-16 pt-14"
        style={{ backgroundColor: 'var(--color-primary-900)' }}
      >
        {/* Grain texture */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            opacity: 0.035,
            backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />

        {/* Organic shapes */}
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute -top-16 -right-16 h-56 w-56 rounded-full"
            style={{ background: 'radial-gradient(circle, var(--color-accent-400) 0%, transparent 70%)', opacity: 0.07 }}
          />
          <div
            className="absolute bottom-8 -left-12 h-40 w-40 rounded-full"
            style={{ background: 'radial-gradient(circle, var(--color-primary-300) 0%, transparent 70%)', opacity: 0.06 }}
          />
        </div>

        <div className="relative">
          <p
            className="text-caption tracking-[0.15em] text-neutral-400"
          >
            {regionsLabel} 독서모임
          </p>
          <h1
            className="mt-3 text-[2.25rem] font-bold leading-[1.15] text-white"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            지독해
          </h1>
          <div className="mt-5 h-px w-[48px] bg-neutral-600" />
          <p className="mt-5 text-sm leading-relaxed text-neutral-300">
            책을 읽고, 사람을 만나고, 생각을 나누는 모임.
            {/* RPC가 없는 환경에서는 회원 수 줄만 숨긴다 — 로그인 화면과 같은 가드 */}
            {memberCount !== null && memberCount !== undefined && (
              <>
                <br />
                {regionsPhrase}에서 {memberCount}명이 함께하고 있어요.
              </>
            )}
          </p>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section
        className="relative z-10 -mt-4 rounded-t-[20px] px-[var(--spacing-page)] pt-10 pb-8"
        style={{ backgroundColor: 'var(--color-surface-50)' }}
      >
        <h2
          className="text-lg font-bold text-neutral-800"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          이용 방법
        </h2>

        <div className="mt-6 space-y-5">
          <StepCard
            number="1"
            title="일정 확인"
            description="매주 열리는 독서모임 일정과 장소, 참가비를 한눈에 확인하세요."
          />
          <StepCard
            number="2"
            title="신청 · 결제"
            description="참여할 모임을 골라 카드로 간편하게 결제하면 신청이 완료됩니다."
          />
          <StepCard
            number="3"
            title="참여"
            description="모임 당일 장소에 오시면 됩니다. 사정이 생기면 언제든 취소할 수 있어요."
          />
        </div>
      </section>

      {/* ── Fee Info ── */}
      <section
        className="px-[var(--spacing-page)] pb-6"
        style={{ backgroundColor: 'var(--color-surface-50)' }}
      >
        <div
          className="rounded-[var(--radius-md)] border border-surface-300 px-5 py-4"
          style={{ backgroundColor: 'var(--color-surface-100)' }}
        >
          <p className="text-sm font-bold text-neutral-800">
            참가비 안내
          </p>
          {/* 금액을 못 박지 않는다 — 대구 정기 모임은 무료라 "12,000원"이 틀린 말이었고,
              참가비는 모임마다 운영자가 정한다. 값은 모임 일정이 항상 맞게 들고 있다 */}
          <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">
            참가비는 <span className="font-semibold text-neutral-700">모임마다 다릅니다</span>. 모임 일정에서 각 모임의 참가비를 확인할 수 있어요.
            <br />카드 결제로 간편하게 신청할 수 있고, 결제 완료 즉시 모임 참여가 확정됩니다.
          </p>
        </div>
      </section>

      {/* ── Info Links ── */}
      <section
        className="px-[var(--spacing-page)] pb-10"
        style={{ backgroundColor: 'var(--color-surface-50)' }}
      >
        <div
          className="rounded-[var(--radius-md)] border border-surface-300 px-5 py-4"
          style={{ backgroundColor: 'var(--color-surface-100)' }}
        >
          <p className="text-sm font-medium text-neutral-700">
            참가비 환불 기준이 궁금하신가요?
          </p>
          <Link
            href="/policy/refund"
            className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary-600 hover:text-primary-700"
          >
            환불정책 보기
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>
        </div>
      </section>
    </div>
  )
}

function StepCard({
  number,
  title,
  description,
}: {
  number: string
  title: string
  description: string
}) {
  return (
    <div className="flex gap-4">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
        style={{ backgroundColor: 'var(--color-primary-600)' }}
      >
        {number}
      </div>
      <div className="pt-0.5">
        <h3 className="text-sm font-bold text-neutral-800">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-neutral-500">{description}</p>
      </div>
    </div>
  )
}
