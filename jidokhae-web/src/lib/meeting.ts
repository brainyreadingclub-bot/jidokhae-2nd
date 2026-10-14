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

  // PGRST116 = 행 없음, 22P02 = uuid 꼴이 아닌 id(잘린 링크 등) — 둘 다 「없는 모임」이다.
  // 22P02를 오류로 던지면 회원에게 404 대신 「화면을 불러오지 못했어요」가 나간다
  if (error && error.code !== 'PGRST116' && error.code !== '22P02') {
    throw new Error(`모임 조회 실패: ${error.message}`)
  }

  return data as Meeting | null
})
