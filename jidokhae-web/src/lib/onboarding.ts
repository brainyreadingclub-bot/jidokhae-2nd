/**
 * 온보딩(웰컴 → 프로필 설정) 완료 판정 — 단일 소스 (2026-08-20).
 * 게이트 화면 렌더는 HomeContent(구 홈)가 담당하고,
 * 새 UI((next) 레이아웃)와 / 리다이렉트는 이 판정으로 미완성 회원을 관문으로 보낸다.
 * 판정 기준은 HomeContent의 이중 게이트와 동일해야 한다.
 */

type OnboardingProfile = {
  welcomed_at: string | null
  profile_completed_at: string | null
  real_name: string | null
} | null

export function isOnboarded(profile: OnboardingProfile): boolean {
  return !!(profile?.welcomed_at && profile.profile_completed_at && profile.real_name)
}
