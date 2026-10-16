/**
 * 모임 전날 리마인드 — 어떤 알림톡 템플릿을 쓸지 고른다 (순수 함수, Supabase import 없음).
 *
 * 갈래 (2026-10-16):
 *   - `discussion` 토론모임 → `MEETING_REMIND_DISCUSSION_V2` (`SOLAPI_TEMPLATE_REMIND_DISCUSSION`)
 *   - `default`    그 외 전부 → `MEETING_REMIND_V2` (`SOLAPI_TEMPLATE_REMIND`)
 *
 * 🔴 **갈래 템플릿의 환경변수가 없으면 지금 동작과 100% 같다.** 그래서 배포 순서를 안 탄다 —
 *    코드가 먼저 나가도 env를 넣기 전까지는 전부 `default`로 간다.
 *
 * 🔴 알림 종류(`type`)는 갈래와 무관하게 전부 `meeting_remind`다. 중복 막기 인덱스
 *    `idx_notifications_remind_unique (recipient_id, meeting_id) WHERE type='meeting_remind'`를
 *    공유하므로 한 사람이 같은 모임에 두 통 받는 일이 구조적으로 없다.
 *    대가로, 한 번 실패한 회원은 그 모임에 다시 못 받는다 — 아래 변수 목록이 틀리면 안 되는 이유다.
 *
 * 모르는 모임 종류·구 데이터 null은 `default`로 떨어진다.
 */

export type RemindVariant = 'default' | 'discussion'

export type RemindTemplateEnv = {
  SOLAPI_TEMPLATE_REMIND?: string
  SOLAPI_TEMPLATE_REMIND_DISCUSSION?: string
}

/**
 * 템플릿별로 **본문·버튼에 실제로 들어 있는** 변수 목록 (솔라피 승인본 기준).
 *
 * 🔴 템플릿에 있는 변수를 하나라도 안 넘기면 솔라피가 발송 전체를 거절한다.
 *    `__tests__/remind-template.test.ts`가 이 목록과 `buildRemindVariables`의 키를 대조해 고정한다.
 *    템플릿을 재심사해 변수가 바뀌면 이 목록부터 고친다.
 */
export const REMIND_TEMPLATE_VARIABLES: Record<RemindVariant, readonly string[]> = {
  // MEETING_REMIND_V2 — 모임 이름 칸이 없다
  default: ['#{회원명}', '#{모임일시}', '#{장소}', '#{참가비}', '#{결제상태}', '#{모임ID}'],
  // MEETING_REMIND_DISCUSSION_V2 (KA01TP261009131434750O8a8LqOqebj) — `#{모임명}`이 있다
  discussion: ['#{회원명}', '#{모임명}', '#{모임일시}', '#{장소}', '#{참가비}', '#{결제상태}', '#{모임ID}'],
}

function present(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim() !== ''
}

/**
 * 이 신청자에게 보낼 템플릿을 고른다.
 * `meetingType`은 `meetings.meeting_type` 그대로 — 화이트리스트로만 갈라서
 * 모르는 종류가 토론 문구를 받는 일이 없게 한다.
 */
export function pickRemindTemplate(params: {
  meetingType: string | null | undefined
  env: RemindTemplateEnv
}): { templateCode: string; variant: RemindVariant } {
  const { meetingType, env } = params

  if (meetingType === 'discussion' && present(env.SOLAPI_TEMPLATE_REMIND_DISCUSSION)) {
    return { templateCode: env.SOLAPI_TEMPLATE_REMIND_DISCUSSION, variant: 'discussion' }
  }

  // 지금 동작 그대로 — 값이 없으면 없는 대로 넘긴다(종전 `process.env.SOLAPI_TEMPLATE_REMIND!`와 같다)
  return { templateCode: env.SOLAPI_TEMPLATE_REMIND as string, variant: 'default' }
}

/**
 * 리마인드 변수 맵. **모든 갈래에 같은 7개를 넘긴다.**
 *
 * 일반 템플릿에는 `#{모임명}`이 없지만 그대로 넘긴다 — 솔라피는 템플릿에 없는
 * 남는 변수는 무시하고 보낸다. 2026-08-11 V2 전환 이후 일반 리마인드가 이 7개를 넘기며
 * 실제로 발송 성공해 온 것이 근거다. 위험한 쪽은 "모자라는 변수"뿐이다.
 */
export function buildRemindVariables(input: {
  displayName: string
  meetingTitle: string
  dateTime: string
  location: string
  fee: string
  paymentStatus: string
  meetingId: string
}): Record<string, string> {
  return {
    '#{회원명}': input.displayName,
    '#{모임명}': input.meetingTitle,
    '#{모임일시}': input.dateTime,
    '#{장소}': input.location,
    '#{참가비}': input.fee,
    '#{결제상태}': input.paymentStatus,
    '#{모임ID}': input.meetingId,
  }
}
