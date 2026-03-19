import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

export const getProfile = cache(async (userId: string) => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('nickname, role, welcomed_at, phone, region, email, real_name, profile_completed_at')
    .eq('id', userId)
    .single()

  if (error) throw new Error(`프로필 조회 실패: ${error.message}`)
  return data as {
    nickname: string
    role: string
    welcomed_at: string | null
    phone: string | null
    region: string[] | null
    email: string | null
    real_name: string | null
    profile_completed_at: string | null
  }
})
