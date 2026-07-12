'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import BookCover from '@/components/library/BookCover'
import { trackEvent } from '@/lib/analytics'
import type { BookSearchResult } from '@/types/book'

type Props = {
  /** 담기 성공 후 콜백 (없으면 router.refresh만) */
  onAdded?: () => void
  /** 물어보기 strip에서 재사용 시: 이 정기모임 출처로 ask 답변 처리 */
  askMeetingId?: string
}

export default function BookSearchInput({ onAdded, askMeetingId }: Props) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<BookSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [addingKey, setAddingKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    setSearching(true)
    setError(null)
    try {
      const res = await fetch(`/api/books/search?q=${encodeURIComponent(q)}`)
      const json = await res.json()
      if (json.status === 'success') {
        setResults(json.data as BookSearchResult[])
      } else {
        setError('검색에 실패했어요. 잠시 후 다시 시도해주세요.')
      }
    } catch {
      setError('검색에 실패했어요. 잠시 후 다시 시도해주세요.')
    } finally {
      setSearching(false)
    }
  }

  async function handleAdd(book: BookSearchResult, key: string) {
    setAddingKey(key)
    setError(null)
    try {
      const res = askMeetingId
        ? await fetch('/api/library/ask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'answer', meetingId: askMeetingId, book }),
          })
        : await fetch('/api/library/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(book),
          })
      const json = await res.json()
      if (json.status === 'success') {
        if (askMeetingId) trackEvent('ask_answered', { meeting_id: askMeetingId })
        setQuery('')
        setResults([])
        if (onAdded) onAdded()
        router.refresh()
      } else {
        setError('담지 못했어요. 다시 시도해주세요.')
      }
    } catch {
      setError('담지 못했어요. 다시 시도해주세요.')
    } finally {
      setAddingKey(null)
    }
  }

  return (
    <div>
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="책 제목으로 검색"
          className="flex-1 min-w-0 rounded-[var(--radius-md)] border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:border-primary-400"
        />
        <button
          type="submit"
          disabled={searching || !query.trim()}
          className="shrink-0 rounded-[var(--radius-md)] bg-primary-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {searching ? '검색 중' : '검색'}
        </button>
      </form>

      {error && <p className="mt-2 text-caption text-accent-500">{error}</p>}

      {results.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {results.map((book, i) => {
            const key = `${book.isbn13 ?? 'noisbn'}-${i}`
            return (
              <li
                key={key}
                className="flex items-center gap-3 rounded-[var(--radius-md)] border border-neutral-200 bg-white p-2"
              >
                <div className="w-10 shrink-0">
                  <BookCover thumbnail={book.thumbnail} title={book.title} />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-sm font-bold text-neutral-800"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {book.title}
                  </p>
                  <p className="truncate text-caption text-neutral-600">
                    {book.authors ?? '저자 미상'}
                    {book.publisher ? ` · ${book.publisher}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => handleAdd(book, key)}
                  disabled={addingKey === key}
                  className="shrink-0 rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-bold text-primary-600 disabled:opacity-50"
                >
                  {addingKey === key ? '담는 중' : '담기'}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
