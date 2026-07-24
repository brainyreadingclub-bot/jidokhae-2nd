'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import BookCover from '@/components/library/BookCover'
import { useLibraryToastOptional } from '@/components/library/LibraryToast'
import { withObjectParticle } from '@/lib/hangul'
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
  const { show } = useLibraryToastOptional()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<BookSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [addingKey, setAddingKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    setSearching(true)
    setSearched(false)
    setError(null)
    try {
      const res = await fetch(`/api/books/search?q=${encodeURIComponent(q)}`)
      const json = await res.json()
      if (json.status === 'success') {
        setResults(json.data as BookSearchResult[])
        setSearched(true)
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
        const result = json.data?.result as 'added' | 'already' | undefined
        if (result === 'already') {
          show({ message: '이미 서재에 있는 책이에요', tone: 'neutral' })
        } else {
          show({ message: `${withObjectParticle(book.title)} 담았어요`, tone: 'success' })
        }
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
          onChange={(e) => {
            setQuery(e.target.value)
            setSearched(false)
          }}
          placeholder="책 제목 일부만 넣어도 돼요"
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

      {!error && !searched && results.length === 0 && (
        <p className="mt-2 text-[11px] text-neutral-400 break-keep">제목 일부만으로 찾을 수 있어요 (예: 데미안)</p>
      )}

      {!error && searched && results.length === 0 && (
        <p className="mt-3 text-caption text-neutral-500 break-keep">
          찾는 책이 안 보이면 제목을 조금 줄이거나 띄어쓰기를 바꿔 다시 검색해보세요.
        </p>
      )}

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
