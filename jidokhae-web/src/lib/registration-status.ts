/**
 * 신청 status 판정 상수 — 순수 상수만 두는 파일(client 번들 안전).
 */

/**
 * "정원을 차지하고 참석 예정인 신청" 판정 status.
 *
 * `pending_transfer`(계좌이체 입금확인 전)를 `confirmed`와 동등 취급한다 —
 * 운영자가 입금 확인을 월말에 몰아서 처리하므로 회원 입장에선 이미 신청이 끝난 상태이고,
 * 안 나갈 사람은 미리 취소하므로 모임일까지 남아있다는 것 자체가 참석 의사의 증거다.
 * (2026-07-15 확정 — 모임 상세 명단/카운트 마스킹 해제, 물어보기 참여 판정과 동일 기준)
 *
 * ⚠️ `confirmed`만 필터하면 계좌이체 운영 중인 현 서비스에서 대부분의 참여자가 누락된다.
 * 실제 사고: 리마인드 크론이 `confirmed`만 조회해 `pending_transfer` 회원이 모임 전날
 * 알림톡을 못 받고 있었다(2026-07-30 발견, 당시 27명). 신청 대상을 고르는 새 코드는
 * 이 상수를 쓸 것.
 */
export const PARTICIPATED_STATUSES = ['confirmed', 'pending_transfer'] as const

/**
 * 알림톡 `#{결제상태}` 치환용 라벨.
 *
 * `pending_transfer`를 **"미입금"으로 부르지 않는다** — 운영자가 입금 확인을 월말에
 * 몰아서 처리하므로 이 상태의 회원은 대부분 이미 돈을 냈다. 낸 사람에게 "미입금"이라고
 * 하면 틀린 말이다. (`VOICE.md` §4 · `feedback_2026-04-07_operator-workflow-first.md`)
 *
 * 두 곳에서 쓴다 — 모임 전날 리마인드, 대기 승격 확정. 둘 다 계좌이체 회원이
 * 입금 확인 전 상태로 도달할 수 있는 지점이다(승격은 RPC가 `payment_method='transfer'`면
 * `pending_transfer`로 분기시킨다).
 */
export function paymentStatusLabel(status: string): string {
  return status === 'pending_transfer' ? '입금 확인 중' : '결제완료'
}
