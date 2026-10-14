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

  // 완독 토글: 누르는 순간 바꿔 둔 값(entryId → completed). 서버 목록이 새로 오면 비운다
  const [completedOverrides, setCompletedOverrides] = useState<Record<string, boolean>>({})
  const [prevEntries, setPrevEntries] = useState(entries)
  if (entries !== prevEntries) {
    setPrevEntries(entries)
    setCompletedOverrides({})
  }
  const isCompleted = (entry: LibraryEntryWithBook) =>
    completedOverrides[entry.id] ?? entry.completed

  const shown = entries.filter((e) => !hiddenIds.has(e.id))
  const visible = expanded ? shown : shown.slice(0, VISIBLE_LIMIT)
  const hasMore = shown.length > VISIBLE_LIMIT

  async function toggleCompleted(entry: LibraryEntryWithBook) {
    // 응답 전 같은 책을 또 누르면 무시한다 — 서버에 순서가 뒤바뀐 두 요청이 가지 않게
    if (togglingId === entry.id) return
    // 누르는 순간 문구를 먼저 바꾼다. 실패하면 되돌리고 알린다
    const before = isCompleted(entry)
    setCompletedOverrides((o) => ({ ...o, [entry.id]: !before }))
    setTogglingId(entry.id)
    try {
      const res = await fetch('/api/library/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId: entry.id, completed: !before }),
      })
      if (!res.ok) throw new Error('complete failed')
      // 화면은 이미 바뀌었다 — 권수 등 다른 숫자가 맞도록 뒤에서 새로 받는다
      router.refresh()
    } catch {
      setCompletedOverrides((o) => ({ ...o, [entry.id]: before }))
      show({ message: '완독 표시를 바꾸지 못했어요. 다시 시도해주세요.', tone: 'neutral' })
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
          // hasMore를 함께 보는 이유: 7권에서 1권을 빼면 hasMore가 false로 떨어져
          // 접기 버튼이 사라지는데(아래 조건부 렌더), expanded는 true로 남아
          // 높이 클램프 + 내부 스크롤만 갇힌 채 되돌릴 수단이 없어진다.
          // hasMore=false면 전량이 이미 보이므로 클램프 자체가 불필요하다.
          expanded && hasMore
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
              aria-pressed={isCompleted(entry)}
              aria-busy={togglingId === entry.id}
              className={
                isCompleted(entry)
                  ? 'mt-1.5 inline-flex items-center gap-1 rounded-[5px] border border-primary-200 bg-primary-50 px-1.5 py-0.5 text-[10px] font-bold text-primary-700'
                  : 'mt-1.5 inline-flex items-center gap-1 rounded-[5px] bg-neutral-100 px-1.5 py-0.5 text-[10px] font-bold text-neutral-600'
              }
            >
              {isCompleted(entry) ? '✓ 완독' : '읽는 중'}
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
