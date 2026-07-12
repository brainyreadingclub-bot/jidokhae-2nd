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
}

// 카카오 검색 결과를 우리 화면용으로 정규화한 형태
export type BookSearchResult = {
  isbn13: string | null
  title: string
  authors: string | null
  publisher: string | null
  thumbnail: string | null
}
