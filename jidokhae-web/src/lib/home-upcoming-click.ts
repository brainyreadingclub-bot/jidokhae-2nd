import { createServiceClient } from '@/lib/supabase/admin'
import type { HomeUpcomingClickRow } from '@/lib/home-upcoming'

/**
 * 홈 「다가오는 정기모임」 클릭 1건 기록. **절대 throw하지 않는다.**
 *
 * - 호출부는 반드시 `after()`로 감쌀 것 — 페이지 응답을 늦추지도, 깨뜨리지도 않는다
 * - 표(`home_upcoming_clicks`)가 아직 없어도 동작한다 — insert 에러를 console에만 남긴다.
 *   그래서 배포 순서를 타지 않는다 (SQL 실행 전 배포 = 기록만 안 남음)
 * - 쓰기는 service_role — 표에 회원용 RLS 규칙을 두지 않는다
 *
 * @example
 *   if (row) after(recordHomeUpcomingClick(row))
 */
export async function recordHomeUpcomingClick(row: HomeUpcomingClickRow): Promise<void> {
  try {
    const supabase = createServiceClient()
    const { error } = await supabase.from('home_upcoming_clicks').insert(row)
    if (error) {
      console.error(`[home-upcoming-click] 기록 실패 (${row.target}):`, error.message)
    }
  } catch (e) {
    console.error(`[home-upcoming-click] 기록 중 예외 (${row.target}):`, e)
  }
}
