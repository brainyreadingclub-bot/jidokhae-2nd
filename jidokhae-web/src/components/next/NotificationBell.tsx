import Link from 'next/link'
import { unreadCount } from '@/lib/app-notifications'

/** 상단 벨 — 미읽음 있으면 주황 점 (Server Component) */
export default async function NotificationBell({ userId }: { userId: string }) {
  const unread = await unreadCount(userId)
  return <BellLink unread={unread} />
}

/**
 * 벨 모양만. 레이아웃이 미읽음 수를 기다리지 않도록 Suspense 대기 화면으로도 쓴다
 * (2026-10-13 — 머리가 알림 수 조회를 기다리느라 모든 새 화면의 첫 그림이 늦었다).
 */
export function BellLink({ unread }: { unread: number }) {
  return (
    <Link
      href="/me/notifications"
      aria-label={unread > 0 ? `알림 ${unread}개` : '알림'}
      className="relative flex h-10 w-10 items-center justify-center text-tg-700"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </svg>
      {unread > 0 && (
        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border-2 border-white bg-warnx" />
      )}
    </Link>
  )
}
