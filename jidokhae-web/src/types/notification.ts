export type Notification = {
  id: string
  type: 'meeting_remind' | 'registration_confirm'
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
