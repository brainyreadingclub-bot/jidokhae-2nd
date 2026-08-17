import { getSiteSettings } from '@/lib/site-settings'

/**
 * 전면 개편(5탭 × 토스 스킨) 플래그.
 * Preview 환경변수 OR site_settings.next_ui === 'on'.
 * 켜는 날 = library_enabled도 함께 켠다 (전면개편 스펙 §8 의존성).
 * isLibraryEnabled()와 같은 패턴 (src/lib/library.ts).
 */
export async function isNextUiEnabled(): Promise<boolean> {
  if (process.env.NEXT_UI_PREVIEW === 'on') return true
  const settings = await getSiteSettings()
  return settings['next_ui'] === 'on'
}
