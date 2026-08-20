import { normalizeIsbn13 } from '@/lib/isbn'
import type { BookSearchResult } from '@/types/book'

// 카카오 v3/search/book document 형태 (필요한 필드만)
type KakaoBookDocument = {
  title: string
  authors: string[]
  publisher: string
  translators: string[]
  thumbnail: string
  isbn: string
  contents: string
  url: string
  datetime: string
  price: number
  sale_price: number
  status: string
}

type KakaoBookResponse = {
  documents: KakaoBookDocument[]
  meta: { total_count: number; pageable_count: number; is_end: boolean }
}

/** 카카오 document → 우리 화면용 정규화 (순수 함수, 테스트 대상) */
export function mapKakaoDocument(doc: KakaoBookDocument): BookSearchResult {
  return {
    isbn13: normalizeIsbn13(doc.isbn),
    title: doc.title,
    authors: doc.authors.length > 0 ? doc.authors.join(', ') : null,
    publisher: doc.publisher || null,
    thumbnail: doc.thumbnail || null,
    description: doc.contents || null,
  }
}

/**
 * 카카오 책 검색 서버 래퍼. REST 키는 서버 전용 env.
 * 실패 시 Error throw (호출한 라우트가 500으로 감싼다).
 */
export async function searchKakaoBooks(query: string, size = 10): Promise<BookSearchResult[]> {
  const key = process.env.KAKAO_REST_API_KEY
  if (!key) throw new Error('KAKAO_REST_API_KEY 미설정')

  const url = new URL('https://dapi.kakao.com/v3/search/book')
  url.searchParams.set('query', query)
  url.searchParams.set('size', String(size))
  url.searchParams.set('sort', 'accuracy')

  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${key}` },
    // 검색은 실시간 — 캐시 안 함
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(`카카오 도서 검색 실패: ${res.status}`)
  }

  const json = (await res.json()) as KakaoBookResponse
  return json.documents.map(mapKakaoDocument)
}
