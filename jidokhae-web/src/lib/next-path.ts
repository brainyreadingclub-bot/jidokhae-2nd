/**
 * 로그인 후 돌아갈 경로(`next`) 검증 — 단일 진입점.
 *
 * 왜 필요한가: 알림톡 딥링크(모임 상세·마이페이지)를 카카오톡 인앱 브라우저로 열면
 * 세션이 없는 경우가 많다. 미들웨어가 목적지를 버리고 /auth/login으로 보내면 로그인
 * 후 홈으로 떨어져 회원은 무엇을 하러 왔는지 알 수 없게 된다. 그 이탈은 지표상
 * "전환율 낮음"으로 잘못 읽힌다(실제로는 도달 자체가 실패).
 *
 * 왜 검증하는가: `next`는 URL 쿼리라 사용자가 조작할 수 있다. 외부 도메인으로 튕기는
 * 오픈 리다이렉트를 막기 위해 "우리 사이트 내부 절대경로"만 허용한다.
 * - `//evil.com`, `/\evil.com` — 브라우저가 프로토콜 상대 URL로 해석해 외부로 나간다
 * - `https://evil.com` — 명백한 외부
 * - `/auth/...` — 로그인 성공 후 다시 로그인 화면으로 보내면 순환한다
 */
export function safeNextPath(raw: string | null | undefined, fallback = '/'): string {
  if (!raw) return fallback
  if (!raw.startsWith('/')) return fallback
  if (raw.startsWith('//') || raw.startsWith('/\\')) return fallback
  if (raw === '/auth' || raw.startsWith('/auth/')) return fallback
  return raw
}

/** 현재 요청 경로를 `next` 값으로 만든다(쿼리스트링 보존, 해시는 서버가 못 본다). */
export function toNextParam(pathname: string, search = ''): string {
  return `${pathname}${search}`
}

/**
 * 딥링크 목적지를 카카오 OAuth 왕복 너머로 실어 나르는 쿠키 이름.
 *
 * 왜 쿼리(`redirectTo=...?next=`)가 아니라 쿠키인가: Supabase Redirect URL 허용목록이
 * 쿼리 붙은 콜백 URL을 거부하면 **전 회원 로그인이 깨진다.** 인증 경로가 외부 대시보드
 * 설정에 의존하지 않도록 쿠키로 넘긴다. OAuth 복귀는 최상위 GET 내비게이션이라
 * SameSite=Lax로 살아남는다.
 */
export const NEXT_COOKIE = 'jdkh_next'

/** 딥링크 쿠키 수명(초). 로그인 왕복에 필요한 만큼만 — 오래 남으면 엉뚱한 이동이 된다. */
export const NEXT_COOKIE_MAX_AGE = 600

/**
 * 이 요청을 "회원이 보려던 화면"으로 기억해도 되는가.
 *
 * 미들웨어 matcher는 /api/* 를 통과시키므로, 세션 만료 시점에 나간 백그라운드 fetch
 * (예: AskStrip의 POST /api/library/ask)도 미인증으로 잡혀 목적지로 기억될 수 있다.
 * 그러면 로그인 직후 JSON 라우트로 GET 리다이렉트되어 405 에러 화면을 보게 된다.
 * 로그인했더니 에러가 뜨는 형태라 회원 입장에서 원인을 짐작할 수 없다.
 *
 * prefetch도 제외한다 — 회원이 누른 적 없는 링크가 로그인 후 목적지가 되면 안 된다.
 */
export function shouldRememberPath(
  method: string,
  pathname: string,
  isPrefetch = false,
): boolean {
  if (method !== 'GET') return false
  if (isPrefetch) return false
  if (pathname.startsWith('/api/')) return false
  return true
}

/**
 * prefetch 요청인가. `sec-purpose`(표준) 또는 `purpose`(구 크롬) 헤더로 판별한다.
 *
 * ⚠️ `next-router-prefetch`를 쓰면 안 된다 — Next.js가 `RSC`와 함께 **미들웨어에 닿기 전에
 * 제거**한다(2026-08-03 로컬 실측: 미들웨어가 받는 헤더 목록에 없음). 그걸로 판별하면
 * 조건이 영원히 거짓이라 가드가 조용한 no-op이 된다.
 *
 * 한계: 위 이유로 **Next.js Link의 라우터 prefetch는 이 방법으로도 감지되지 않는다.**
 * 브라우저가 보내는 speculation rules prefetch만 걸린다. 다만 비로그인 회원에게는
 * 보호 라우트 링크가 렌더되지 않으므로 실제 노출 면적은 좁다.
 */
export function isPrefetchRequest(
  secPurpose: string | null,
  purpose: string | null,
): boolean {
  const value = secPurpose ?? purpose ?? ''
  return value.toLowerCase().includes('prefetch')
}
