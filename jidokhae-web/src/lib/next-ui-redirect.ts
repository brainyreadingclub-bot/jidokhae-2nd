/**
 * 미들웨어가 화면을 그리기 전에 새 화면(next_ui)으로 바로 보내는 규칙 — 순수 함수 (2026-10-13).
 *
 * 왜 미들웨어인가: 페이지에서 redirect()하면 옛 레이아웃을 그리느라 DB를 두세 번 기다린 뒤에야
 * 넘어가고, 로딩 경계 안에서 던져지면 HTML을 다 보낸 다음 브라우저가 다시 이동한다.
 * 첫 주소(/)가 속도 점수 54점이던 원인이다.
 *
 * 판정 기준은 `isNextUiEnabled`(next-ui.ts)·`isOnboarded`(onboarding.ts)·옛 상세 페이지의
 * redirect와 같아야 한다. 페이지 쪽 redirect는 안전망으로 남아 있다.
 */

/** 알림톡 버튼이 가리키는 옛 모임 상세. 그 아래 결제 화면(/confirm, /payment-*)은 대상이 아니다 */
const OLD_MEETING_DETAIL = /^\/meetings\/([^/]+)$/

/** 이 주소가 판정 대상인가 — 대상이 아니면 미들웨어는 DB를 읽지 않는다 */
export function redirectCandidate(pathname: string): 'root' | 'old-detail' | null {
  if (pathname === '/') return 'root'
  if (OLD_MEETING_DETAIL.test(pathname)) return 'old-detail'
  return null
}

/** 프로필(온보딩)을 읽어야 하는가 — 첫 주소만 */
export function needsOnboardingCheck(pathname: string): boolean {
  return redirectCandidate(pathname) === 'root'
}

/**
 * 보낼 곳. 없으면 null.
 * - `/` → `/home`: 온보딩을 마친 회원만. 미완성 회원은 `/`의 관문을 그대로 본다.
 *   (`(next)` 레이아웃이 미완성 회원을 `/`로 돌려보내므로 여기서 같은 판정을 안 하면 순환한다)
 * - `/meetings/[id]` → `/meet/[id]`: 플래그만 본다(옛 상세 페이지와 같은 조건).
 *   온보딩 미완성 회원은 `/meet`의 레이아웃이 관문으로 보낸다.
 */
export function nextUiRedirectTarget(
  pathname: string,
  nextUiOn: boolean,
  onboarded: boolean,
): string | null {
  if (!nextUiOn) return null
  const kind = redirectCandidate(pathname)
  if (kind === 'old-detail') return `/meet/${OLD_MEETING_DETAIL.exec(pathname)![1]}`
  if (kind === 'root') return onboarded ? '/home' : null
  return null
}
