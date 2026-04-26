/**
 * 모임 신청자 수를 일반 사용자에게 가릴지 결정한다.
 *
 * 적은 신청자 수가 "인기 없는 모임"처럼 보이는 social proof 역효과를 방지하기 위해
 * 정원 50% 미만일 때 숫자를 가리고 "N명 모집 중"으로만 표시한다.
 *
 * 우선순위:
 * - 마감(count >= capacity): 마감 안내가 마스킹보다 우선 → 항상 노출
 * - 0명: 기존 행동 보존 (운영자 포함 모두 마스킹 — "N명 모집 중")
 * - 운영자(isPrivileged): 1명 이상이면 항상 정확한 숫자 노출
 * - 일반 사용자 + 정원 절반 미만 + 마감 아님: 마스킹
 *
 * 50% 임계는 ceil 기준이라 홀수 정원에서 보수적이다 (정원 5명 → 3명부터 노출).
 */
export function shouldMaskConfirmedCount(
  confirmedCount: number,
  capacity: number,
  isPrivileged: boolean,
): boolean {
  if (confirmedCount >= capacity) return false
  if (confirmedCount === 0) return true
  if (isPrivileged) return false
  return confirmedCount * 2 < capacity
}
