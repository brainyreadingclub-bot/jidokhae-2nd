import { cache } from 'react'
import { createServiceClient } from '@/lib/supabase/admin'

/** site_settings.payment_mode 기본값 — DB에 값이 없을 때 사용 */
export const DEFAULT_PAYMENT_MODE = 'card_only'

/**
 * Server Component 전용. React cache()로 동일 요청 내 중복 호출 방지.
 * service_role 사용 — 미들웨어를 안 거치는 public 페이지에서도 안정적으로 조회.
 */
export const getSiteSettings = cache(async (): Promise<Record<string, string>> => {
  const supabase = createServiceClient()
  const { data } = await supabase.from('site_settings').select('key, value')
  const settings: Record<string, string> = {}
  for (const row of data ?? []) {
    settings[row.key] = row.value
  }
  return settings
})
