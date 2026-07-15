/**
 * 카카오 isbn 필드에서 ISBN13(13자리, 978/979 시작)만 정규화해 반환.
 * 판본 파편화 방지용 정규화 키. 13자리가 없으면 null(희귀본 자유입력 fallback).
 */
export function normalizeIsbn13(raw: string | null | undefined): string | null {
  if (!raw) return null
  const tokens = raw.split(/\s+/)
  for (const token of tokens) {
    const digits = token.replace(/[^0-9Xx]/g, '')
    if (digits.length === 13 && (digits.startsWith('978') || digits.startsWith('979'))) {
      return digits
    }
  }
  return null
}
