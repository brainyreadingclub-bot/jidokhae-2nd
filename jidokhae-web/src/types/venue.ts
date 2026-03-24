export type Venue = {
  id: string
  name: string
  settlement_type: 'percentage' | 'fixed' | 'none'
  settlement_rate: number
  settlement_fixed: number
  contact_name: string | null
  contact_info: string | null
  status: 'active' | 'inactive'
  created_at: string
}

export type VenueSettlement = {
  id: string
  venue_id: string
  month: string
  total_paid: number
  settlement_amount: number
  settled_at: string | null
  settled_by: string | null
  created_at: string
}
