/**
 * 큐레이터 = 발제 등록·수정·핀, (2단계) 번개 신고 처리 권한.
 * 2026-08-17 결정: admin · editor · 스텝(is_staff) — is_staff에 할인 외 권한이 생기는 첫 사례.
 * 개인정보·정산 접근은 기존 매트릭스 그대로 불가.
 * DB의 is_curator() SQL 함수와 동기 필수 (migration-discussion-thread.sql).
 */
export function isCurator(p: { role: string; is_staff: boolean | null }): boolean {
  return p.role === 'admin' || p.role === 'editor' || p.is_staff === true
}
