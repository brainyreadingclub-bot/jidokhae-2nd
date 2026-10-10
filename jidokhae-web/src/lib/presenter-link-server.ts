import { createHash, randomBytes } from 'node:crypto'
import { createServiceClient } from '@/lib/supabase/admin'
import { getKSTToday } from '@/lib/kst'
import { isLinkOpen, isValidToken } from '@/lib/presenter-link'

/**
 * 발제자 링크 — 서버 전용(service_role). 토큰 검사는 여기서만 한다.
 * topic_presenter_links는 RLS ON + 정책 없음이라 anon·로그인 회원 키로는 읽히지 않는다.
 */

/** 추측할 수 없는 링크 토큰 — 24바이트 무작위 → base64url 32자 */
export function generateToken(): string {
  return randomBytes(24).toString('base64url')
}

/** 기기 표시는 원문을 저장하지 않는다 — 해시만 저장하고 비교한다 */
export function hashDevice(device: string): string {
  return createHash('sha256').update(`jdkh-presenter:${device}`).digest('hex')
}

export type OpenLink = {
  meeting_id: string
  created_by: string
  meeting: { id: string; title: string; date: string; time: string }
}

/**
 * 토큰으로 열린 링크를 찾는다. 닫혔거나(운영자·날짜·모임 상태) 없는 토큰·바뀐 토큰이면 null.
 * 🔴 「없는 토큰」과 「닫힌 링크」를 구분해 알려주지 않는다 — 어떤 모임인지 새지 않게(시안 F3).
 */
export async function findOpenLink(token: string): Promise<OpenLink | null> {
  if (!isValidToken(token)) return null
  const admin = createServiceClient()
  const { data: link } = await admin
    .from('topic_presenter_links')
    .select('meeting_id, created_by, closed_at')
    .eq('token', token)
    .maybeSingle()
  if (!link) return null
  const { data: meeting } = await admin
    .from('meetings')
    .select('id, title, date, time, status, meeting_type')
    .eq('id', link.meeting_id)
    .maybeSingle()
  if (!meeting || !isLinkOpen(link, meeting, getKSTToday())) return null
  return {
    meeting_id: link.meeting_id,
    created_by: link.created_by,
    meeting: { id: meeting.id, title: meeting.title, date: meeting.date, time: meeting.time },
  }
}
