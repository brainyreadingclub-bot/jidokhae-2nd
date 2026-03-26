import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

// ⚠️ 중요: 이 함수는 미들웨어가 getUser()로 세션을 갱신한 직후에만 안전.
// 미들웨어를 수정할 때 이 커플링을 반드시 고려할 것.
// getSession()은 쿠키를 로컬 디코딩하므로 네트워크 호출 없음 (~0ms).
export const getUser = cache(async () => {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session?.user ?? null
})
