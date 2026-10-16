/**
 * 모임 종류 규칙표 — `meetings.meeting_type`을 판정하는 단일 진입점.
 *
 * 왜 있나 — 호출부마다 `=== 'discussion'`을 각자 쓰다 보니, 새 종류(작업실·별책부록)가
 * 들어오면 「토론 아니면 정기」로 읽혀 정기 목록에 섞이거나 「정기모임」 라벨이 붙는다.
 * 종류별로 달라지는 규칙은 이 표 한 곳에서 읽는다.
 * 설계: `docs/설계/specs/2026-10-14-기타모임-틀-설계.md` · 결정: DECISIONS.md 2026-10-16 「모임은 두 갈래」
 *
 * - 종류를 늘리는 조건 = 돈(환불·할인) · 자격 · 알림 중 하나라도 규칙이 다를 때만.
 *   주제(연말파티·북토크…)는 종류가 아니라 제목으로 구분한다 → 한 번짜리는 전부 `event`(별책부록)
 * - 스텝 할인(`pricing.ts`)·물어보기(`asks-pure.ts`)·토론 자격 세기(`discussion-eligibility.ts`)는
 *   이미 `=== 'regular'` 화이트리스트라 새 종류에 저절로 안 붙는다. 돈 코드라 이 표로 옮기지 않는다
 */

export type MeetingKind = 'regular' | 'discussion' | 'workshop' | 'event'

/** 환불 규칙 묶음 — `lib/refund.ts`의 규칙 상수 이름과 짝 */
export type RefundPolicy = 'regular' | 'discussion'

/** 모임 탭 안 자리 — 토론(표지 카드) / 정기·작업실(날짜 행) / 별책부록(사진·티켓형 카드) */
export type MeetSection = 'discussion' | 'regular' | 'event'

type KindRule = {
  /** 회원·운영자 화면에 보이는 이름 */
  label: string
  /** 운영자 화면의 짧은 이름 */
  shortLabel: string
  refund: RefundPolicy
  meetSection: MeetSection
}

export const MEETING_KINDS: Record<MeetingKind, KindRule> = {
  regular: { label: '정기모임', shortLabel: '정기', refund: 'regular', meetSection: 'regular' },
  discussion: { label: '토론모임', shortLabel: '토론', refund: 'discussion', meetSection: 'discussion' },
  // 작업실 = 정기와 같은 환불 3일/2일 (2026-10-16)
  workshop: { label: '작업실', shortLabel: '작업실', refund: 'regular', meetSection: 'regular' },
  // 별책부록(DB 값 event) = 토론과 같은 환불 14일/7일 (2026-10-16)
  event: { label: '별책부록', shortLabel: '별책부록', refund: 'discussion', meetSection: 'event' },
}

/** 운영자 모임 폼 선택지 순서 */
export const MEETING_KIND_OPTIONS: MeetingKind[] = ['regular', 'discussion', 'workshop', 'event']

export function isMeetingKind(value: unknown): value is MeetingKind {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(MEETING_KINDS, value)
}

/**
 * 모르는 값·null은 정기 규칙으로 읽는다 — **환불과 화면 라벨에서만.**
 * 구 데이터 폴백(refund.ts 종전 동작과 같다). 할인·자격 같은 혜택 판정에는 쓰지 않는다
 */
function ruleOf(meetingType: string | null | undefined): KindRule {
  return isMeetingKind(meetingType) ? MEETING_KINDS[meetingType] : MEETING_KINDS.regular
}

export function getRefundPolicy(meetingType: string | null | undefined): RefundPolicy {
  return ruleOf(meetingType).refund
}

export function getMeetingKindLabel(meetingType: string | null | undefined): string {
  return ruleOf(meetingType).label
}

export function getMeetingKindShortLabel(meetingType: string | null | undefined): string {
  return ruleOf(meetingType).shortLabel
}

export function getMeetSection(meetingType: string | null | undefined): MeetSection {
  return ruleOf(meetingType).meetSection
}
