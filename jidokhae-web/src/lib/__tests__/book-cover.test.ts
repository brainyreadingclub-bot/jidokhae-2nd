import { describe, it, expect } from 'vitest'
import { highResCoverUrl } from '@/lib/book-cover'

// 실제 카카오 검색 API 응답 형태 (2026-07-31 실측)
const KAKAO_THUMB =
  'https://search1.kakaocdn.net/thumb/R120x174.q85/?fname=http%3A%2F%2Ft1.daumcdn.net%2Flbook%2Fimage%2F540810%3Ftimestamp%3D20260528110944'
const ORIGINAL = 'https://t1.daumcdn.net/lbook/image/540810?timestamp=20260528110944'

describe('highResCoverUrl', () => {
  it('카카오 썸네일에서 원본 URL을 꺼내고 https로 올린다', () => {
    expect(highResCoverUrl(KAKAO_THUMB)).toBe(ORIGINAL)
  })

  it('fname이 이미 https면 그대로 쓴다', () => {
    const thumb = 'https://search1.kakaocdn.net/thumb/R120x174.q85/?fname=https%3A%2F%2Fexample.com%2Fa.jpg'
    expect(highResCoverUrl(thumb)).toBe('https://example.com/a.jpg')
  })

  it('null은 null', () => {
    expect(highResCoverUrl(null)).toBeNull()
  })

  it('fname이 없는 URL은 손대지 않는다', () => {
    const plain = 'https://cdn.example.com/cover/123.jpg'
    expect(highResCoverUrl(plain)).toBe(plain)
  })

  it('디코딩이 깨지면 원본 썸네일을 그대로 돌려준다', () => {
    const broken = 'https://search1.kakaocdn.net/thumb/R120x174.q85/?fname=%E0%A4%A'
    expect(highResCoverUrl(broken)).toBe(broken)
  })

  it('http·https가 아닌 값이 들어오면 손대지 않는다', () => {
    const weird = 'https://search1.kakaocdn.net/thumb/R120x174.q85/?fname=%2Frelative%2Fpath.jpg'
    expect(highResCoverUrl(weird)).toBe(weird)
  })

  it('fname 뒤에 다른 파라미터가 붙어도 fname만 정확히 잘라낸다', () => {
    const thumb =
      'https://search1.kakaocdn.net/thumb/R120x174.q85/?fname=https%3A%2F%2Fexample.com%2Fa.jpg&q=90'
    expect(highResCoverUrl(thumb)).toBe('https://example.com/a.jpg')
  })
})
