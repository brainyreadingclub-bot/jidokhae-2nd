import { getUser } from '@/lib/auth'
import { getProfile } from '@/lib/profile'
import { createServiceClient } from '@/lib/supabase/admin'
import { unreadCount } from '@/lib/app-notifications'
import { Sec, RowItem } from '@/components/next/TossUI'

/**
 * 나 탭 — 카운터(명사: 서재·발제 답변)·내 활동 (전면개편 스펙 §2).
 * 번개 호스트 카운터는 2단계에서 추가.
 * 신청 내역·프로필 수정은 구경로(/my) 재사용 (스펙 §6).
 */
export default async function MePage() {
  const user = await getUser()
  const profile = user ? await getProfile(user.id) : null
  const admin = createServiceClient()

  const [shelfCount, answerCount, unread] = user
    ? await Promise.all([
        admin
          .from('library_entries')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .then(({ count }) => count ?? 0),
        admin
          .from('topic_answers')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .then(({ count }) => count ?? 0),
        unreadCount(user.id),
      ])
    : [0, 0, 0]

  const joinedAt = profile?.profile_completed_at ?? profile?.welcomed_at ?? null
  const joined = joinedAt
    ? `${new Date(joinedAt).getFullYear()}년 ${new Date(joinedAt).getMonth() + 1}월부터`
    : ''
  const regionLabel = profile?.region?.length ? profile.region.join(' · ') : ''

  return (
    <div className="pt-2">
      <div className="mt-4 flex items-center gap-3">
        <span className="flex h-12 w-12 flex-none items-center justify-center rounded-[17px] bg-brand-bg text-lg font-extrabold text-brand-deep">
          {(profile?.nickname || '회').slice(0, 1)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-base font-extrabold tracking-tight">
            {profile?.nickname || '회원'}
          </p>
          <p className="truncate text-[11px] text-tg-600">
            {joined}
            {regionLabel ? ` · ${regionLabel}` : ''}
          </p>
        </div>
      </div>

      {/* 카운터 — 명사 (2026-08-15 결정) */}
      <div className="mt-4 grid grid-cols-2 overflow-hidden rounded-[18px] bg-tg-100">
        <div className="py-4 text-center">
          <p className="text-[23px] font-extrabold tracking-tight text-brand-deep tabular-nums">
            {shelfCount}
          </p>
          <p className="mt-1 text-[11px] font-bold text-tg-600">서재</p>
        </div>
        <div className="border-l border-tg-200 py-4 text-center">
          <p className="text-[23px] font-extrabold tracking-tight text-brand-deep tabular-nums">
            {answerCount}
          </p>
          <p className="mt-1 text-[11px] font-bold text-tg-600">발제 답변</p>
        </div>
      </div>

      <Sec>내 활동</Sec>
      <RowItem emoji="🧾" tone="blue" title="신청 내역" sub="내 모임 신청과 취소" href="/my" />
      <RowItem
        emoji="🔔"
        tone="green"
        title="알림"
        right={
          unread > 0 ? (
            <span className="flex-none text-xs font-bold text-brand">{unread} ›</span>
          ) : undefined
        }
        href="/me/notifications"
      />
      <RowItem emoji="⚙️" tone="yellow" title="프로필 · 설정" sub="닉네임 · 연락처 · 지역" href="/my" />
    </div>
  )
}
