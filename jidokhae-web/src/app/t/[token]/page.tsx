import type { Metadata } from 'next'
import { findOpenLink } from '@/lib/presenter-link-server'
import { linkClosesAtLabel } from '@/lib/presenter-link'
import { formatKoreanDate, formatKoreanTime } from '@/lib/kst'
import PresenterView from '@/components/presenter/PresenterView'

/**
 * 발제자 링크 화면 — 로그인 없음 (2차, 시안 F1~F3 `docs/설계/mockups/2026-10-10-발제문-새방식/`).
 * 회원(토스) 스킨 · 세리프 없음 · 하단 탭 없음. 검색에 노출하지 않는다.
 * 닫힌 링크·없는 토큰은 똑같이 「닫혔어요」 — 어떤 모임인지 보이지 않게(F3).
 */
export const metadata: Metadata = {
  title: '발제 쓰기',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
}

export const dynamic = 'force-dynamic'

export default async function PresenterPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const link = await findOpenLink(token)

  return (
    <div className="min-h-screen bg-white text-tg-900">
      <header className="flex h-12 items-center px-5 text-[17px] font-extrabold tracking-tight text-brand-deep">
        지독해
      </header>
      {link ? (
        <PresenterView
          token={token}
          meetingTitle={link.meeting.title}
          meetingWhen={`${formatKoreanDate(link.meeting.date)} ${formatKoreanTime(link.meeting.time)} 토론모임`}
          closesLabel={linkClosesAtLabel(link.meeting.date)}
        />
      ) : (
        <ClosedView />
      )}
    </div>
  )
}

function ClosedView() {
  return (
    <main className="flex min-h-[calc(100vh-48px)] flex-col items-center justify-center px-7 pb-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-tg-100 text-tg-600">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
      </div>
      <h1 className="mt-[18px] text-xl font-extrabold tracking-tight">이 링크는 닫혔어요</h1>
      <p className="mt-2 text-sm leading-relaxed text-tg-600">
        모임이 끝났거나 운영자가 링크를 닫았어요.
        <br />
        고칠 게 있으면 운영자에게 말해 주세요.
      </p>
    </main>
  )
}
