'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import BookCover from '@/components/library/BookCover'
import { useLibraryToast } from '@/components/library/LibraryToast'
import { withObjectParticle } from '@/lib/hangul'
import { askSourceLabel } from '@/lib/asks-pure'
import type { LibraryEntryWithBook } from '@/types/book'

const VISIBLE_LIMIT = 6
const UNDO_MS = 6500

type Props = {
  entries: LibraryEntryWithBook[]
}

export default function LibraryGrid({ entries }: Props) {
  const router = useRouter()
  const { show } = useLibraryToast()
  const [expanded, setExpanded] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())
  // 대기 중인 삭제 커밋 타이머 (entryId → timeout)
  const pendingRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const shown = entries.filter((e) => !hiddenIds.has(e.id))
  const visible = expanded ? shown : shown.slice(0, VISIBLE_LIMIT)
  const hasMore = shown.length > VISIBLE_LIMIT

  async function toggleCompleted(entry: LibraryEntryWithBook) {
    setTogglingId(entry.id)
    try {
      await fetch('/api/library/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId: entry.id, completed: !entry.completed }),
      })
      router.refresh()
    } finally {
      setTogglingId(null)
    }
  }

  function commitDelete(entryId: string, keepalive = false) {
    pendingRef.current.delete(entryId)
    fetch('/api/library/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entryId }),
      keepalive,
    })
      .then((res) => {
        if (!res.ok) throw new Error('delete failed')
        router.refresh()
      })
      .catch(() => {
        // 실패 시 카드 복구 + 알림
        setHiddenIds((prev) => {
          const next = new Set(prev)
          next.delete(entryId)
          return next
        })
        show({ message: '서재에서 빼지 못했어요. 다시 시도해주세요.', tone: 'neutral' })
      })
  }

  function requestRemove(entry: LibraryEntryWithBook) {
    setMenuId(null)
    setHiddenIds((prev) => new Set(prev).add(entry.id))
    const timer = setTimeout(() => commitDelete(entry.id), UNDO_MS)
    pendingRef.current.set(entry.id, timer)
    show({
      message: `${withObjectParticle(entry.books.title)} 서재에서 뺐어요`,
      tone: 'neutral',
      durationMs: UNDO_MS,
      action: {
        label: '실행취소',
        onClick: () => {
          const t = pendingRef.current.get(entry.id)
          if (t) clearTimeout(t)
          pendingRef.current.delete(entry.id)
          setHiddenIds((prev) => {
            const next = new Set(prev)
            next.delete(entry.id)
            return next
          })
        },
      },
    })
  }

  // 언마운트(화면 이탈) 시 대기 중 삭제는 즉시 커밋 — 삭제 의도 유실 방지
  useEffect(() => {
    const pending = pendingRef.current
    return () => {
      for (const [entryId, timer] of pending) {
        clearTimeout(timer)
        commitDelete(entryId, true)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div>
      <div
        className={
          expanded
            ? 'max-h-[420px] overflow-y-auto pr-1 grid grid-cols-3 gap-3'
            : 'grid grid-cols-3 gap-3'
        }
      >
        {visible.map((entry) => (
          <div key={entry.id} className="relative">
            <BookCover thumbnail={entry.books.thumbnail} title={entry.books.title} />

            <button
              onClick={() => setMenuId((v) => (v === entry.id ? null : entry.id))}
              aria-label="더보기"
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="5" cy="12" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="19" cy="12" r="2" />
              </svg>
            </button>

            {menuId === entry.id && (
              <>
                <button
                  aria-hidden
                  tabIndex={-1}
                  onClick={() => setMenuId(null)}
                  className="fixed inset-0 z-10 cursor-default"
                />
                <div className="absolute right-1 top-8 z-20 w-max rounded-[var(--radius-md)] border border-neutral-200 bg-white py-1 shadow-lg">
                  <button
                    onClick={() => requestRemove(entry)}
                    className="block px-3 py-1.5 text-xs font-semibold text-neutral-700"
                  >
                    서재에서 빼기
                  </button>
                </div>
              </>
            )}

            <button
              onClick={() => toggleCompleted(entry)}
              disabled={togglingId === entry.id}
              className={
                entry.completed
                  ? 'mt-1.5 inline-flex items-center gap-1 rounded-[5px] border border-primary-200 bg-primary-50 px-1.5 py-0.5 text-[10px] font-bold text-primary-700 disabled:opacity-50'
                  : 'mt-1.5 inline-flex items-center gap-1 rounded-[5px] bg-neutral-100 px-1.5 py-0.5 text-[10px] font-bold text-neutral-600 disabled:opacity-50'
              }
            >
              {entry.completed ? '✓ 완독' : '읽는 중'}
            </button>
            {entry.source === 'ask' && (
              <p className="mt-0.5 text-[10px] text-neutral-400 leading-tight break-keep">
                {askSourceLabel(entry.source_meeting_date) ?? '모임에서 담음'}
              </p>
            )}
          </div>
        ))}
      </div>

      {hasMore && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 w-full text-center text-sm font-semibold text-primary-600"
        >
          {expanded ? '접기' : `최근 6권 · 전체 ${shown.length}권 보기 ›`}
        </button>
      )}
    </div>
  )
}
