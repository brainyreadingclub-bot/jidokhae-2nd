export type Meeting = {
  id: string
  title: string
  description: string | null
  date: string // "YYYY-MM-DD"
  time: string // "HH:MM:SS"
  location: string
  venue_id: string | null
  capacity: number
  fee: number
  status: 'active' | 'deleting' | 'deleted'
  // 토론모임 개편 0조각 — 정기/토론 구분
  meeting_type: 'regular' | 'discussion'
  // Phase 3 (WP7-2)
  region: string // VALID_REGIONS 중 1, default '경주'
  is_featured: boolean // 인라인 PICK 배너 노출 대상
  chat_link: string | null
  reading_link: string | null
  detail_address: string | null
  // 토론모임 ↔ 책 연결 (2026-08-18 표지 배치 확정)
  book_id: string | null
  selection_reason: string | null
  created_at: string
  updated_at: string
}

/** meetings에서 books를 nested select한 형태 (`.select('*, books(...)')`) */
export type MeetingBookJoin = {
  title: string
  authors: string | null
  publisher: string | null
  thumbnail: string | null
  description: string | null
}

export type MeetingWithCount = Meeting & {
  confirmedCount: number
  isRegistered: boolean
}
