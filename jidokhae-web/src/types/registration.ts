import type { Meeting } from './meeting'

export type Registration = {
  id: string
  user_id: string
  meeting_id: string
  status: 'confirmed' | 'cancelled' | 'waitlisted' | 'waitlist_cancelled' | 'waitlist_refunded' | 'pending_transfer'
  cancel_type:
    | 'user_cancelled'
    | 'meeting_deleted'
    | 'waitlist_user_cancelled'
    | 'waitlist_auto_refunded'
    /** 돈 낸 회원을 발제자로 바꾸며 닫은 신청 (2026-10-13) */
    | 'presenter_swap'
    /** 발제자를 빼며 닫은 0원 발제자 신청 (2026-10-13) */
    | 'presenter_removed'
    | null
  payment_id: string | null
  paid_amount: number | null
  refunded_amount: number | null
  created_at: string
  cancelled_at: string | null
  /** 'none' = 결제 없음 — 발제자 행 전용 (DB CHECK가 다른 행에는 막는다, 2026-10-13) */
  payment_method: 'card' | 'transfer' | 'none'
  is_staff_discount: boolean
  /**
   * 토론모임 발제자 행. ⚠️ `migration-discussion-presenter.sql` 실행 전에는 칸이 없어 undefined다.
   * 판정은 이 칸이 아니라 `isPresenterRow()`(lib/presenter-rules.ts)로 한다
   */
  is_presenter?: boolean
}

export type RegistrationWithMeeting = Registration & {
  meetings: Meeting
}

export type RegistrationWithProfile = Registration & {
  profiles: { nickname: string; real_name: string | null; phone: string | null }
}
