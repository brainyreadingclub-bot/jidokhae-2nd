export type Book = {
  id: string
  isbn13: string | null
  title: string
  authors: string | null
  publisher: string | null
  thumbnail: string | null
  created_at: string
}

export type LibraryEntry = {
  id: string
  user_id: string
  book_id: string
  source: 'manual' | 'ask'
  source_meeting_id: string | null
  completed: boolean
  created_at: string
}

export type LibraryEntryWithBook = LibraryEntry & {
  books: Book
  // Plan B: source='ask'인 항목의 출처 정기모임 날짜(라벨 "N월 정기모임에서"용). 없으면 null
  source_meeting_date?: string | null
}

// 카카오 검색 결과를 우리 화면용으로 정규화한 형태
export type BookSearchResult = {
  isbn13: string | null
  title: string
  authors: string | null
  publisher: string | null
  thumbnail: string | null
}
