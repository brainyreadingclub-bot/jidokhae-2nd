import { createServiceClient } from '@/lib/supabase/admin'
import type { AppNotification, AppNotificationType } from '@/types/app-notification'

/**
 * 인앱 알림. 알림톡과 역할 분담(전면개편 스펙 §4-2):
 * 알림톡 = 시간 민감(리마인드·승격·환불·물어보기) / 인앱 = 누적(답글·공감·발제 등록·새 번개·신청 확정).
 * 알림은 부가 기능 — 실패해도 본 흐름을 막지 않는다. 호출부는 void로 fire-and-forget.
 */
export async function createAppNotification(
  userId: string,
  type: AppNotificationType,
  payload: Record<string, unknown>,
): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('app_notifications')
    .insert({ user_id: userId, type, payload })
  if (error) console.error('[app-notifications] insert 실패:', error.message)
}

/**
 * 공감 알림 폭주 방지 (스펙 §10 QA — 묶음 처리).
 * 미읽음 동일 (answer_reaction, answer_id) 알림이 있으면 payload·시각만 갱신.
 */
export async function upsertReactionNotification(
  userId: string,
  payload: { answer_id: string; actor_nickname: string; total_count: number },
): Promise<void> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('app_notifications')
    .select('id')
    .eq('user_id', userId)
    .eq('type', 'answer_reaction')
    .is('read_at', null)
    .contains('payload', { answer_id: payload.answer_id })
    .limit(1)
  if (data && data.length > 0) {
    await supabase
      .from('app_notifications')
      .update({ payload, created_at: new Date().toISOString() })
      .eq('id', data[0].id)
  } else {
    await createAppNotification(userId, 'answer_reaction', payload)
  }
}

export async function listAppNotifications(
  userId: string,
  limit = 30,
): Promise<AppNotification[]> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('app_notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data ?? []) as AppNotification[]
}

export async function unreadCount(userId: string): Promise<number> {
  const supabase = createServiceClient()
  const { count } = await supabase
    .from('app_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null)
  return count ?? 0
}

export async function markAllRead(userId: string): Promise<void> {
  const supabase = createServiceClient()
  await supabase
    .from('app_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null)
}
