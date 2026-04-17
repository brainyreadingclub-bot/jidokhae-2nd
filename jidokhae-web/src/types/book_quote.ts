export type BookQuoteStatus = 'pending' | 'approved' | 'rejected'

export type BookQuote = {
  id: string
  book_title: string
  quote_text: string // CHECK char_length <= 200
  submitted_by: string // profiles.id (FK, ON DELETE CASCADE)
  status: BookQuoteStatus
  approved_at: string | null
  created_at: string
}

// 홈 노출용 — 닉네임 마스킹 처리된 형태
export type BookQuoteWithSubmitter = BookQuote & {
  submitter_masked_name: string // "김○님" 형식
}
