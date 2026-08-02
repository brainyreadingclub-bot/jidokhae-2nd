/**
 * 카카오 책 표지 URL → 원본 해상도 URL.
 *
 * 카카오 검색 API가 주는 thumbnail은 `R120x174.q85` 리사이즈본(120×174)이다.
 * 3열 그리드 한 칸이 CSS 110px라 3배 밀도 기기에서는 330px가 필요한데,
 * 120px를 2.75배로 늘려 쓰던 탓에 표지 글자가 뭉개졌다(2026-07-31 실측).
 *
 * 리사이즈 규격을 키우는 경로(R240x348 등)는 403으로 막혀 있고, thumbnail URL의
 * `fname` 파라미터가 원본 이미지 주소(실측 458×670, 약 3.8배)를 그대로 담고 있어
 * 이걸 풀어 쓰는 것이 유일한 해법이다.
 *
 * 렌더 시점 변환이라 이미 담긴 책에도 적용된다(DB 마이그레이션 불필요).
 * 형태가 다른 URL·디코딩 실패는 원본 인자를 그대로 돌려주어 최소한 지금 화면을 유지한다.
 */
export function highResCoverUrl(thumbnail: string | null): string | null {
  if (!thumbnail) return null

  const match = thumbnail.match(/[?&]fname=([^&]+)/)
  if (!match) return thumbnail

  let decoded: string
  try {
    decoded = decodeURIComponent(match[1])
  } catch {
    // 잘못 인코딩된 값 — 원본 유지
    return thumbnail
  }

  // http 원본도 https로 올려 혼합 콘텐츠 차단을 피한다
  if (decoded.startsWith('https://')) return decoded
  if (decoded.startsWith('http://')) return 'https://' + decoded.slice('http://'.length)

  // 예상 밖 스킴(상대 경로 등)은 손대지 않는다
  return thumbnail
}
