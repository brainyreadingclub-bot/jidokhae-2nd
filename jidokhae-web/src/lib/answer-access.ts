import { cache } from 'react'
import { createServiceClient } from '@/lib/supabase/admin'
import { PARTICIPATED_STATUSES } from '@/lib/registration-status'
import { isCurator } from '@/lib/curator'
import {
  canReadAnswers,
  isRevealAfterOwnOn,
  topicAnswerView,
  type TopicAnswerView,
} from '@/lib/answer-access-rules'

/**
 * 이 회원이 이 모임의 발제 답변을 어디까지 읽을 수 있는가 (Server 전용).
 * 신청 행은 「살아 있는 행이 하나라도 있나」로 본다 — 취소 후 재신청하면 한 모임에 행이 여럿이다.
 *
 * `canRead`는 모임 단위 자격(신청자·운영진)이다. 발제 하나에서 남의 답을 보는지는
 * 응답 후 공개 때문에 발제마다 다르다 — `viewForTopic`으로 판정한다.
 */
export const getAnswerAccess = cache(
  async (userId: string | null, meetingId: string) => {
    const admin = createServiceClient()
    // select('*') — 응답 후 공개 칸(answers_reveal_after_own)이 SQL 실행 전이라 없어도 깨지지 않게
    const { data: meeting } = await admin
      .from('meetings')
      .select('*')
      .eq('id', meetingId)
      .maybeSingle()
    const revealAfterOwn = meeting
      ? isRevealAfterOwnOn(meeting as { meeting_type?: string | null; answers_reveal_after_own?: boolean | null })
      : false
    if (!userId) {
      return { canRead: false, live: false, waitlisted: false, presenter: false, curator: false, revealAfterOwn }
    }
    // 프로필도 service client로 — API Route에서도 같은 함수를 쓴다(쿠키 클라이언트에 기대지 않는다)
    const [{ data: regs }, { data: profile }] = await Promise.all([
      admin
        .from('registrations')
        .select('status, payment_method')
        .eq('user_id', userId)
        .eq('meeting_id', meetingId),
      admin.from('profiles').select('role, is_staff').eq('id', userId).maybeSingle(),
    ])
    const rows = (regs ?? []) as { status: string; payment_method: string | null }[]
    const live = rows.some((r) => (PARTICIPATED_STATUSES as readonly string[]).includes(r.status))
    // 발제자 행 = confirmed · payment_method 'none' (CHECK로 is_presenter와 묶여 있다 — 코드는 이쪽으로 가린다)
    const presenter = rows.some((r) => r.status === 'confirmed' && r.payment_method === 'none')
    const typedProfile = (profile as { role: string; is_staff: boolean | null } | null) ?? null
    return {
      canRead: canReadAnswers(live, typedProfile),
      live,
      waitlisted: !live && rows.some((r) => r.status === 'waitlisted'),
      presenter,
      curator: typedProfile ? isCurator(typedProfile) : false,
      revealAfterOwn,
    }
  },
)

export type AnswerAccess = Awaited<ReturnType<typeof getAnswerAccess>>

/** 발제 하나에서의 상태 — 모임 단위 자격 + 그 발제에 자기 답이 있나 */
export function viewForTopic(access: AnswerAccess, answeredHere: boolean): TopicAnswerView {
  return topicAnswerView({
    live: access.live,
    presenter: access.presenter,
    curator: access.curator,
    revealAfterOwn: access.revealAfterOwn,
    answeredHere,
  })
}

/** 이 회원이 답을 남긴 발제 id들 (본문은 읽지 않는다) */
export async function getMyAnsweredTopicIds(
  userId: string | null,
  topicIds: string[],
): Promise<Set<string>> {
  if (!userId || topicIds.length === 0) return new Set()
  const { data } = await createServiceClient()
    .from('topic_answers')
    .select('topic_id')
    .eq('user_id', userId)
    .in('topic_id', topicIds)
  return new Set(((data ?? []) as { topic_id: string }[]).map((r) => r.topic_id))
}
