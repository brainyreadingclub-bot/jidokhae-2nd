import { describe, it, expect } from 'vitest'
import { mapKakaoDocument } from '@/lib/kakao-books'

describe('mapKakaoDocument', () => {
  it('카카오 document를 BookSearchResult로 정규화한다', () => {
    const doc = {
      title: '아주 사적인 독서',
      authors: ['이현우'],
      publisher: '마음산책',
      translators: [],
      thumbnail: 'https://search1.kakaocdn.net/thumb/cover.jpg',
      isbn: '8936434268 9788936434267',
      contents: '요약...',
      url: 'https://search.daum.net/book/1',
      datetime: '2020-01-01T00:00:00.000+09:00',
      price: 15000,
      sale_price: 13500,
      status: '정상판매',
    }
    expect(mapKakaoDocument(doc)).toEqual({
      isbn13: '9788936434267',
      title: '아주 사적인 독서',
      authors: '이현우',
      publisher: '마음산책',
      thumbnail: 'https://search1.kakaocdn.net/thumb/cover.jpg',
      description: '요약...',
    })
  })

  it('contents 빈 문자열은 description null로 바꾼다', () => {
    const doc = {
      title: '소개없음', authors: [], publisher: '', translators: [],
      thumbnail: '', isbn: '9788900000009', contents: '', url: '',
      datetime: '', price: 0, sale_price: 0, status: '정상판매',
    }
    expect(mapKakaoDocument(doc).description).toBeNull()
  })

  it('저자가 여러 명이면 ", "로 결합한다', () => {
    const doc = {
      title: '공저 책', authors: ['김작가', '이작가'], publisher: '출판사',
      translators: [], thumbnail: '', isbn: '9788900000009',
      contents: '', url: '', datetime: '', price: 0, sale_price: 0, status: '정상판매',
    }
    expect(mapKakaoDocument(doc).authors).toBe('김작가, 이작가')
  })

  it('thumbnail 빈 문자열은 null로 바꾼다', () => {
    const doc = {
      title: '표지없음', authors: [], publisher: '', translators: [],
      thumbnail: '', isbn: '9788900000009', contents: '', url: '',
      datetime: '', price: 0, sale_price: 0, status: '정상판매',
    }
    const r = mapKakaoDocument(doc)
    expect(r.thumbnail).toBeNull()
    expect(r.authors).toBeNull()
  })

  it('ISBN13이 없으면 isbn13은 null이지만 title은 유지한다', () => {
    const doc = {
      title: '희귀본', authors: ['저자'], publisher: '출판사', translators: [],
      thumbnail: 'x', isbn: '8936434268', contents: '', url: '',
      datetime: '', price: 0, sale_price: 0, status: '정상판매',
    }
    const r = mapKakaoDocument(doc)
    expect(r.isbn13).toBeNull()
    expect(r.title).toBe('희귀본')
  })
})
