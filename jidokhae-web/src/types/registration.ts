import type { Meeting } from './meeting'

export type Registration = {
  id: string
  user_id: string
  meeting_id: string
  status: 'confirmed' | 'cancelled'
  cancel_type: 'user_cancelled' | 'meeting_deleted' | null
  payment_id: string | null
  paid_amount: number | null
  refunded_amount: number | null
  created_at: string
  cancelled_at: string | null
}

export type RegistrationWithMeeting = Registration & {
  meetings: Meeting
}

export type RegistrationWithProfile = Registration & {
  profiles: { nickname: string }
}
