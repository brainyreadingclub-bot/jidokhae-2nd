import type { Meeting } from './meeting'

export type Registration = {
  id: string
  user_id: string
  meeting_id: string
  status: 'confirmed' | 'cancelled' | 'waitlisted' | 'waitlist_cancelled' | 'waitlist_refunded'
  cancel_type: 'user_cancelled' | 'meeting_deleted' | 'waitlist_user_cancelled' | 'waitlist_auto_refunded' | null
  payment_id: string | null
  paid_amount: number | null
  refunded_amount: number | null
  created_at: string
  cancelled_at: string | null
  attended: boolean | null
}

export type RegistrationWithMeeting = Registration & {
  meetings: Meeting
}

export type RegistrationWithProfile = Registration & {
  profiles: { nickname: string; real_name: string | null }
}
