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
  created_at: string
  updated_at: string
}

export type MeetingWithCount = Meeting & {
  confirmedCount: number
  isRegistered: boolean
}
