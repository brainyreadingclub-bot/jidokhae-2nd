'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { trackEvent } from '@/lib/analytics'
import type { AppNotification } from '@/types/app-notification'

/**
 * 알림함 (전면개편 스펙 §4-2).
 * 마운트 시 전체 읽음 처리 — 벨 점은 다음 렌더에서 꺼진다.
 */
export default function NotificationList({ items }: { items: AppNotification[] }) {
  useEffect(() => {
    trackEvent('notification_open')
    fetch('/api/notifications/read', { method: 'POST' }).catch(() => {})
  }, [])

  if (items.length === 0) {
    return (
      <div className="mt-8 rounded-[18px] border border-dashed border-tg-300 p-6 text-center">
        <p className="text-sm font-bold text-tg-700">아직 알림이 없어요</p>
        <p className="mt-1 text-xs text-tg-600">
          발제에 답을 남기면 반응이 여기로 와요
        </p>
      </div>
    )
  }

  return (
    <div className="mt-2">
      {items.map((n) => {
        const p = n.payload as Record<string, string | number | undefined>
        const unread = n.read_at === null
        const { emoji, title, sub, href } = renderNotification(n.type, p)
        const inner = (
          <>
            <span
              className={`flex h-9 w-9 flex-none items-center justify-center rounded-[12px] text-sm ${
                unread ? 'bg-white' : 'bg-tg-100'
              }`}
              aria-hidden
            >
              {emoji}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-bold leading-snug tracking-tight text-tg-900">
                {title}
              </span>
              {sub && (
                <span className="mt-0.5 line-clamp-2 block text-xs text-tg-600">{sub}</span>
              )}
              <span className="mt-0.5 block text-[11px] text-tg-500">
                {formatWhen(n.created_at)}
              </span>
            </span>
          </>
        )
        const cls = `flex items-start gap-2.5 py-3 ${
          unread ? 'rounded-[14px] bg-brand-bg px-3 my-1' : 'border-t border-tg-100 first:border-t-0'
        }`
        return href ? (
          <Link key={n.id} href={href} className={cls}>
            {inner}
          </Link>
        ) : (
          <div key={n.id} className={cls}>
            {inner}
          </div>
        )
      })}
    </div>
  )
}

function renderNotification(
  type: AppNotification['type'],
  p: Record<string, string | number | undefined>,
): { emoji: string; title: string; sub?: string; href?: string } {
  switch (type) {
    case 'answer_reply':
      return {
        emoji: '💬',
        title: `${p.actor_nickname ?? '회원'}님이 내 답변에 답글을 남겼어요`,
        sub: p.preview ? String(p.preview) : undefined,
        href: p.topic_id ? `/talk/topics/${p.topic_id}` : undefined,
      }
    case 'answer_reaction': {
      const n = Number(p.total_count ?? 1)
      return {
        emoji: '❤️',
        title:
          n > 1
            ? `${p.actor_nickname ?? '회원'}님 외 ${n - 1}명이 내 답변에 공감했어요`
            : `${p.actor_nickname ?? '회원'}님이 내 답변에 공감했어요`,
      }
    }
    case 'topic_posted':
      return {
        emoji: '📖',
        title: '새 발제문이 올라왔어요',
        sub: p.title ? `발제 ${p.topic_no ?? ''} · ${p.title}` : undefined,
        href: '/talk',
      }
    case 'flash_opened':
      return { emoji: '⚡', title: '새 번개가 열렸어요', href: '/meet' }
    case 'flash_cancelled':
      return { emoji: '⚡', title: '참여한 번개가 취소됐어요' }
    case 'registration_confirmed':
      return { emoji: '✓', title: '모임 신청이 확정됐어요', href: '/meet' }
    case 'announcement':
      return {
        emoji: '📢',
        title: String(p.title ?? '공지'),
        sub: p.body ? String(p.body) : undefined,
        href: p.href ? String(p.href) : undefined,
      }
  }
}

function formatWhen(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 60) return mins <= 1 ? '방금' : `${mins}분 전`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}일 전`
  return `${Math.floor(days / 7)}주 전`
}
