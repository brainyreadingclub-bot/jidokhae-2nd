import { createClient } from '@/lib/supabase/server'
import { getRegionPublicComments, isReviewEnabled } from '@/lib/review'
import PublicCommentsList from '@/components/next/review/PublicCommentsList'

/**
 * 모임 소개의 「지난 모임에서 남긴 한 줄」 (시안 20).
 * 같은 지역 · 정기 · 이 모임보다 앞선 모임 · 최근 180일의 공개 소감 — 판정은 RPC 한 벌
 * (`get_region_public_comments`). 운영자가 내린 것 · 회원이 내린 것은 RPC가 거른다.
 *
 * 스위치가 꺼져 있거나, 정기모임이 아니거나, 소감이 없으면 아무것도 그리지 않는다 (빈 섹션 금지).
 * RPC가 아직 없어도(마이그레이션 전) 빈 목록으로 떨어진다 — 모임 상세는 그대로다.
 */
export default async function RegionPublicComments({
  meetingId,
  meetingType,
}: {
  meetingId: string
  meetingType: string | null
}) {
  if (meetingType !== 'regular') return null
  if (!(await isReviewEnabled())) return null

  const supabase = await createClient()
  const comments = await getRegionPublicComments(supabase, meetingId, 20)
  if (comments.length === 0) return null

  return <PublicCommentsList comments={comments} />
}
