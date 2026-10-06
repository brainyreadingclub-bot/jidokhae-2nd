/**
 * 법적 표시(약관 링크 · 사업자정보)의 단일 소스.
 *
 * 값은 `site_settings`에서 오고(운영자가 /admin/settings에서 고친다),
 * 값이 없을 때의 기본값도 **여기 한 곳에만** 둔다 —
 * 두 곳에 적으면 운영자가 설정을 바꿔도 한쪽만 바뀐다 (2026-09-19 A2 시안 판단).
 *
 * 쓰는 곳: 구 스킨 `components/Footer.tsx`, 5탭 「나」 탭 `components/next/AccountFooter.tsx`.
 */

export type BusinessInfo = {
  companyName: string
  representative: string
  businessNumber: string
  address: string
  phone: string
}

/** `getSiteSettings()` 결과 → 사업자정보. 기본값은 migration.sql seed와 같은 값이다. */
export function resolveBusinessInfo(settings: Record<string, string>): BusinessInfo {
  return {
    companyName: settings['company_name'] ?? '지독해',
    representative: settings['representative'] ?? '임재윤',
    businessNumber: settings['business_number'] ?? '494-42-01276',
    address: settings['address'] ?? '경상북도 경주시 태종로 801-11 (황오동) 208호',
    phone: settings['phone'] ?? '0507-1396-7908',
  }
}

export type PolicyLink = { href: string; label: string }

/** 비로그인 화면(푸터)용 전량 */
export const POLICY_LINKS: PolicyLink[] = [
  { href: '/policy/meetings', label: '모임 일정' },
  { href: '/policy/terms', label: '이용약관' },
  { href: '/policy/privacy', label: '개인정보처리방침' },
  { href: '/policy/refund', label: '환불정책' },
  { href: '/policy/about', label: '서비스 소개' },
]

/**
 * 로그인한 회원 화면(5탭 「나」)용 3종.
 *
 * 🔴 「모임 일정」·「서비스 소개」 2개를 **일부러 뺐다** — 앞엣것은 모임 탭과 하는 일이 같고
 * 뒤엣것은 비로그인 방문자용 소개다 (2026-09-19 시안).
 * **갈라지는 것이 의도다. 누락으로 보고 되돌리지 말 것.**
 */
export const MEMBER_POLICY_LINK_HREFS = ['/policy/terms', '/policy/privacy', '/policy/refund']

export const MEMBER_POLICY_LINKS: PolicyLink[] = POLICY_LINKS.filter((l) =>
  MEMBER_POLICY_LINK_HREFS.includes(l.href)
)
