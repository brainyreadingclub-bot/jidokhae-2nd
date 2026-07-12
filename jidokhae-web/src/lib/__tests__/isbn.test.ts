import { describe, it, expect } from 'vitest'
import { normalizeIsbn13 } from '@/lib/isbn'

describe('normalizeIsbn13', () => {
  it('"ISBN10 ISBN13" 공백 구분에서 13자리를 뽑는다', () => {
    expect(normalizeIsbn13('8936434268 9788936434267')).toBe('9788936434267')
  })

  it('ISBN13만 있으면 그대로 반환한다', () => {
    expect(normalizeIsbn13('9788936434267')).toBe('9788936434267')
  })

  it('ISBN10만 있으면(13자리 없음) null을 반환한다', () => {
    expect(normalizeIsbn13('8936434268')).toBeNull()
  })

  it('하이픈을 제거한다', () => {
    expect(normalizeIsbn13('978-89-364-3426-7')).toBe('9788936434267')
  })

  it('빈 문자열/공백/null은 null을 반환한다', () => {
    expect(normalizeIsbn13('')).toBeNull()
    expect(normalizeIsbn13('   ')).toBeNull()
    expect(normalizeIsbn13(null)).toBeNull()
    expect(normalizeIsbn13(undefined)).toBeNull()
  })

  it('979로 시작하는 ISBN13도 인식한다', () => {
    expect(normalizeIsbn13('9791162540808')).toBe('9791162540808')
  })
})
