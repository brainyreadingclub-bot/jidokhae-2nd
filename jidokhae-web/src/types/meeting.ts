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
  // Phase 3 (WP7-2)
  region: string // VALID_REGIONS 중 1, default '경주'
  is_featured: boolean // 인라인 PICK 배너 노출 대상
  chat_link: string | null
  reading_link: string | null
  detail_address: string | null
  created_at: string
  updated_at: string
}

export type MeetingWithCount = Meeting & {
  confirmedCount: number
  isRegistered: boolean
}
