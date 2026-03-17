import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

export const getProfile = cache(async (userId: string) => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('nickname, role')
    .eq('id', userId)
    .single()

  if (error) throw new Error(`프로필 조회 실패: ${error.message}`)
  return data as { nickname: string; role: string }
})
