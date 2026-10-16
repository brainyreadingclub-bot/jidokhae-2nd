import BackLink from '@/components/next/BackLink'
import FeedbackForm from '@/components/next/FeedbackForm'
import { sanitizeFeedbackPath } from '@/lib/member-feedback'

/**
 * 나 탭 → 불편한 점 알려 주기 (보관함 I-001). 오류 화면에서도 들어온다.
 * 로그인 회원만 — 미들웨어가 미로그인을 /auth/login으로 보내고, 보내기 API도 한 번 더 막는다.
 *
 * 들어오는 주소: `/me/feedback` (나 탭) · `/me/feedback?src=error&from=/meet/abc` (오류 화면).
 * `from`은 경로만 받는다 — 쿼리·외부 주소는 `sanitizeFeedbackPath`가 버린다
 */
export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ src?: string; from?: string }>
}) {
  const sp = await searchParams
  const source = sp.src === 'error' ? 'error' : 'me'
  const from = sanitizeFeedbackPath(sp.from)
  // 오류 화면에서 왔으면 그 화면으로 돌아간다(다시 시도). 경로가 없으면 홈으로
  const backHref = source === 'error' ? (from ?? '/home') : '/me'

  return (
    <div className="pt-1">
      <BackLink href={backHref} label="불편한 점 알려 주기" />
      <FeedbackForm source={source} pagePath={source === 'error' ? from : '/me'} backHref={backHref} />
    </div>
  )
}
