import { cache } from 'react'
import { createServiceClient } from '@/lib/supabase/admin'
import { PARTICIPATED_STATUSES } from '@/lib/registration-status'
import { canReadAnswers } from '@/lib/answer-access-rules'

/**
 * 이 회원이 이 모임의 발제 답변을 읽을 수 있는가 (Server 전용).
 * 신청 행은 「살아 있는 행이 하나라도 있나」로 본다 — 취소 후 재신청하면 한 모임에 행이 여럿이다.
 */
export const getAnswerAccess = cache(
  async (userId: string | null, meetingId: string) => {
    if (!userId) return { canRead: false, live: false, waitlisted: false }
    const admin = createServiceClient()
    // 프로필도 service client로 — API Route에서도 같은 함수를 쓴다(쿠키 클라이언트에 기대지 않는다)
    const [{ data: regs }, { data: profile }] = await Promise.all([
      admin
        .from('registrations')
        .select('status')
        .eq('user_id', userId)
        .eq('meeting_id', meetingId),
      admin.from('profiles').select('role, is_staff').eq('id', userId).maybeSingle(),
    ])
    const statuses = (regs ?? []).map((r) => r.status as string)
    const live = statuses.some((s) => (PARTICIPATED_STATUSES as readonly string[]).includes(s))
    return {
      canRead: canReadAnswers(live, (profile as { role: string; is_staff: boolean | null } | null) ?? null),
      live,
      waitlisted: !live && statuses.includes('waitlisted'),
    }
  },
)
