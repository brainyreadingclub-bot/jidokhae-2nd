/**
 * 모임 신청자 수를 일반 사용자에게 가릴지 결정한다.
 *
 * 적은 신청자 수가 "인기 없는 모임"처럼 보이는 social proof 역효과를 방지하기 위해
 * 신청자가 3명 미만일 때 숫자를 가리고 "N명 모집 중"으로만 표시한다.
 *
 * 정책 (정원과 무관한 절대 임계 = 3명):
 * - 마감(count >= capacity): 마감 안내가 마스킹보다 우선 → 항상 노출
 * - 운영자(isPrivileged): 0명만 마스킹, 1명+면 정확한 숫자 노출
 * - 일반 사용자: 3명 미만(0·1·2명) 마스킹, 3명+ 정확한 숫자 노출
 *
 * 참고: 정원은 폼 단에서 최소 3명으로 제한되므로(MeetingForm), 정원 < 3 케이스는
 *       정상 운영에서 발생하지 않는다고 가정한다.
 */
const MIN_VISIBLE_COUNT = 3

export function shouldMaskConfirmedCount(
  confirmedCount: number,
  capacity: number,
  isPrivileged: boolean,
): boolean {
  if (confirmedCount >= capacity) return false
  if (isPrivileged) return confirmedCount === 0
  return confirmedCount < MIN_VISIBLE_COUNT
}
