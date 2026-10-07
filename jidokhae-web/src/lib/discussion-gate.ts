/**
 * 토론모임 관문 — 서버 전용(service_role). 두 가지를 한 자리에 둔다.
 *
 *  `isDiscussionMeetingEnabled()` — 격리 플래그. 토론모임 하나만 끄는 롤백 수단
 *  `getDiscussionEligibility()`   — 참여 자격(정기모임 1회 이상, 평생). 판정은 순수 함수에
 *
 * 🔴 플래그 OFF가 막는 것은 **새로 들어오는 것뿐이다.**
 *    이미 결제한 회원의 조회·취소·환불은 플래그와 무관하게 항상 살아 있다 —
 *    끈 상태에서 취소가 막히면 환불 경로 자체가 사라진다.
 *    (검토문서/2026-08-22-토론자격-판정규칙.md §2-2, D-7 선례와 같은 규칙)
 */

import { cache } from 'react'
import { getSiteSettings } from '@/lib/site-settings'
import { createServiceClient } from '@/lib/supabase/admin'
import { getKSTToday } from '@/lib/kst'
import { isCurator } from '@/lib/curator'
import { PARTICIPATED_STATUSES } from '@/lib/registration-status'
import {
  canApplyToMeeting,
  hasRegularAttendance,
  type AttendanceRow,
} from '@/lib/discussion-eligibility'

/**
 * 토론모임 격리 플래그. `site_settings.discussion_meeting_enabled === 'on'` 일 때만 노출.
 * 행이 없으면 OFF — `isNextUiEnabled()`·`isLibraryEnabled()`와 같은 모양.
 * `DISCUSSION_PREVIEW === 'on'` env는 Vercel Preview 전용 우회(Production 미설정).
 */
export async function isDiscussionMeetingEnabled(): Promise<boolean> {
  if (process.env.DISCUSSION_PREVIEW === 'on') return true
  const settings = await getSiteSettings()
  return settings.discussion_meeting_enabled === 'on'
}

/**
 * 자격 판정 결과.
 *
 * 🔴 **`not_eligible`(자격 없음)과 `query_failed`(조회 실패)를 절대 합치지 않는다.**
 * 합치면 DB가 잠깐 흔들린 것을 "자격 없음"으로 읽고, `payment.ts`가 **이미 승인된 결제를
 * 환불한다.** 같은 모양의 사고가 실제로 있었다 — 조회 실패를 "대상 없음"으로 덮어 6명
 * 72,000이 나갔다 (2026-10-06, `docs/agent-team/조사/2026-10-06-중복환불-사고.md`).
 */
export type DiscussionEligibility =
  | { kind: 'eligible'; via: 'bypass' | 'participation' }
  | { kind: 'not_eligible' }
  | { kind: 'query_failed' }

/**
 * 이 회원이 토론모임에 신청할 자격이 있는가.
 * 판정 규칙은 `lib/discussion-eligibility.ts`에, 조회만 여기에.
 *
 * RPC(SECURITY DEFINER)를 만들지 않는다 — 자격은 과거 참여로 결정되는 값이라
 * 동시성 경합이 없다(스텝 할인 슬롯과 다르다). 본인 이력만 세면 되므로 권한도 충분하다.
 */
export const getDiscussionEligibility = cache(
  async (userId: string): Promise<DiscussionEligibility> => {
    const admin = createServiceClient()

    const [profileResult, regsResult] = await Promise.all([
      admin.from('profiles').select('role, is_staff').eq('id', userId).maybeSingle(),
      admin
        .from('registrations')
        .select('status, meetings(date, meeting_type, status)')
        .eq('user_id', userId)
        .in('status', PARTICIPATED_STATUSES),
    ])

    // 운영 주체(admin·editor·is_staff)는 검사 통과 — 진행자·발제자가 게이트에 걸리면 운영이 멈춘다.
    // 집합이 isCurator()와 정확히 같다: 발제는 쓰는데 신청은 못 하는 사람을 만들지 않는다.
    // 🔴 `is_free`는 우회에 넣지 않는다 — 정산용 플래그를 권한으로 번지게 하지 않는다 (2026-07-05 경계)
    const profile = profileResult.data as { role: string; is_staff: boolean | null } | null
    if (profile && isCurator(profile)) return { kind: 'eligible', via: 'bypass' }

    // 프로필 조회가 실패했으면 우회 여부를 **모른다.** 운영자를 미자격으로 깎지 않는다
    if (profileResult.error) return { kind: 'query_failed' }
    if (regsResult.error) return { kind: 'query_failed' }

    const rows = (regsResult.data ?? []) as unknown as AttendanceRow[]
    const eligible = canApplyToMeeting('discussion', {
      isCurator: false,
      hasRegularAttendance: hasRegularAttendance(rows, getKSTToday()),
    })
    return eligible ? { kind: 'eligible', via: 'participation' } : { kind: 'not_eligible' }
  },
)

/**
 * 잠글 것인가 — 호출부 전부가 이 한 줄을 공유한다.
 *
 * 🔴 **`query_failed`에서는 잠그지 않는다(fail open).** 자격은 사회적 규칙이고,
 * 잠그는 쪽 비용이 훨씬 크다 — `payment.ts`에서는 이미 승인된 결제를 되돌리는 일이 되고,
 * 그러면 "돈도 신청도 없는 상태"를 만들지 않는다는 규칙과 정면으로 부딪힌다.
 * DB가 흔들린 틈에 미자격자 한 명이 들어오는 것은 운영자가 되돌릴 수 있다.
 */
export async function canApplyToDiscussion(userId: string): Promise<boolean> {
  const result = await getDiscussionEligibility(userId)
  if (result.kind === 'query_failed') {
    console.error(`[discussion-gate] 자격 조회 실패 — 잠그지 않고 통과시킴: ${userId}`)
    return true
  }
  return result.kind === 'eligible'
}

/** 신청 차단 사유 — 없으면 null(통과) */
export type DiscussionBlock = 'paused' | 'not_eligible'

/**
 * 🔴 서버 신청 경로의 단일 진입점. 카드 결제(`payment.ts`)·계좌이체(transfer route)·
 * 화면 버튼(`meeting-detail.ts`)이 전부 이 함수를 거친다.
 * 유형 검사는 함수 안에 있으므로 호출부는 `meetingType`만 넘긴다 —
 * 호출부가 `meeting_type === 'discussion' && ...`를 각자 반복하면 한 곳이 빠져도 안 드러난다
 * (환불 7/3 미배선 사고의 모양).
 *
 * 반환값이 null이 아니면 **새 신청을 거절**한다. 이미 만들어진 신청에는 쓰지 않는다.
 */
export async function getDiscussionApplyBlock(
  meetingType: string | null | undefined,
  userId: string,
): Promise<DiscussionBlock | null> {
  if (meetingType !== 'discussion') return null
  if (!(await isDiscussionMeetingEnabled())) return 'paused'
  if (!(await canApplyToDiscussion(userId))) return 'not_eligible'
  return null
}

/** 거절 사유 → 회원에게 보여줄 문장 */
export const DISCUSSION_BLOCK_MESSAGE: Record<DiscussionBlock, string> = {
  paused: '지금은 토론모임 신청을 받고 있지 않아요',
  not_eligible: '정기모임에 한 번 다녀오면 신청할 수 있어요',
}
