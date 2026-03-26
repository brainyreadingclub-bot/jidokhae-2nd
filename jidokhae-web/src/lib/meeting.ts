import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { Meeting } from '@/types/meeting'

// 같은 렌더링 내에서 generateMetadata()와 페이지 본문이 동일 모임을 중복 조회하지 않도록 cache() 적용
export const getMeeting = cache(async (id: string) => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('meetings')
    .select('*')
    .eq('id', id)
    .single()

  if (error && error.code !== 'PGRST116') {
    throw new Error(`모임 조회 실패: ${error.message}`)
  }

  return data as Meeting | null
})
