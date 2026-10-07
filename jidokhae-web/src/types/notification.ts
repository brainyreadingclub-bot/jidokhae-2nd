/**
 * 알림 종류. DB `notifications.type` CHECK 제약과 반드시 같은 목록이어야 한다.
 * 종류를 추가할 때는 (1) 이 목록 (2) CHECK 제약 마이그레이션 (3) 중복 방지
 * 인덱스 세 가지가 함께 나가야 한다.
 *
 * ⚠️ 이 파일이 유일한 정의다. `lib/notification.ts`가 이걸 가져다 쓴다 —
 * 예전에 양쪽에 따로 적어두는 바람에 종류가 늘 때마다 한쪽만 갱신돼 어긋났다.
 */
export type NotificationType =
  | 'meeting_remind'
  | 'registration_confirm'
  | 'waitlist_confirm'
  | 'waitlist_promoted'
  | 'waitlist_refunded'
  | 'book_ask'
  | 'new_member_welcome'

export type Notification = {
  id: string
  type: NotificationType
  recipient_id: string
  recipient_phone: string
  meeting_id: string | null
  registration_id: string | null
  template_code: string
  status: 'pending' | 'sent' | 'failed' | 'skipped'
  solapi_message_id: string | null
  error_message: string | null
  created_at: string
  sent_at: string | null
}
