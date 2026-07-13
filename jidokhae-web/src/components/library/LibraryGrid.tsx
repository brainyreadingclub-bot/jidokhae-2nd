'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import BookCover from '@/components/library/BookCover'
import { askSourceLabel } from '@/lib/asks-pure'
import type { LibraryEntryWithBook } from '@/types/book'

const VISIBLE_LIMIT = 6

type Props = {
  entries: LibraryEntryWithBook[]
}

export default function LibraryGrid({ entries }: Props) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const visible = expanded ? entries : entries.slice(0, VISIBLE_LIMIT)
  const hasMore = entries.length > VISIBLE_LIMIT

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
          <div key={entry.id}>
            <BookCover thumbnail={entry.books.thumbnail} title={entry.books.title} />
            <button
              onClick={() => toggleCompleted(entry)}
              disabled={togglingId === entry.id}
              className={
                entry.completed
                  ? 'mt-1.5 inline-flex items-center gap-1 rounded-[5px] border border-primary-200 bg-primary-50 px-1.5 py-0.5 text-[10px] font-bold text-primary-700 disabled:opacity-50'
                  : 'mt-1.5 inline-flex items-center gap-1 rounded-[5px] bg-neutral-100 px-1.5 py-0.5 text-[10px] font-bold text-neutral-600 disabled:opacity-50'
              }
            >
              {entry.completed ? '✓ 완독' : '완독 표시'}
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
          {expanded ? '접기' : `최근 6권 · 전체 ${entries.length}권 보기 ›`}
        </button>
      )}
    </div>
  )
}
