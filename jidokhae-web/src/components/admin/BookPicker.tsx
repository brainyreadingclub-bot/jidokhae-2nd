'use client'

import { useState } from 'react'
import type { BookSearchResult } from '@/types/book'

export type PickedBook = {
  id: string
  title: string
  authors: string | null
  thumbnail: string | null
}

type Props = {
  selected: PickedBook | null
  onSelect: (book: PickedBook) => void
  onClear: () => void
}

const inputClassName =
  'w-full rounded-[var(--radius-md)] px-3.5 py-3 text-sm font-medium text-primary-900 placeholder:text-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-400/40 transition-shadow'

const inputStyle = {
  backgroundColor: 'var(--color-surface-50)',
  border: '1px solid var(--color-surface-300)',
}

/**
 * 토론모임 책 연결용 검색·선택 (2026-08-18 표지 배치).
 * 검색은 기존 /api/books/search 재사용, 선택 시 /api/admin/books로 book_id 확보.
 * BookSearchInput(서재 담기용)과 달리 담기가 아니라 선택만 한다.
 */
export default function BookPicker({ selected, onSelect, onClear }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<BookSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [picking, setPicking] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSearch() {
    const q = query.trim()
    if (!q) return
    setSearching(true)
    setError(null)
    try {
      const res = await fetch(`/api/books/search?q=${encodeURIComponent(q)}`)
      const json = await res.json()
      if (json.status !== 'success') throw new Error()
      setResults(json.data as BookSearchResult[])
      setSearched(true)
    } catch {
      setError('검색에 실패했어요. 잠시 후 다시 시도해 주세요')
    }
    setSearching(false)
  }

  async function handlePick(book: BookSearchResult, key: string) {
    setPicking(key)
    setError(null)
    try {
      const res = await fetch('/api/admin/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book }),
      })
      const json = await res.json()
      if (json.status !== 'success') throw new Error()
      onSelect({
        id: json.data.id,
        title: book.title,
        authors: book.authors,
        thumbnail: book.thumbnail,
      })
      setResults([])
      setSearched(false)
      setQuery('')
    } catch {
      setError('책 연결에 실패했어요. 잠시 후 다시 시도해 주세요')
    }
    setPicking(null)
  }

  if (selected) {
    return (
      <div
        className="flex items-center gap-3 rounded-[var(--radius-md)] p-3"
        style={{ backgroundColor: 'var(--color-surface-50)', border: '1px solid var(--color-surface-300)' }}
      >
        {selected.thumbnail ? (
          <img
            src={selected.thumbnail}
            alt={selected.title}
            width={40}
            height={60}
            className="h-[60px] w-[40px] flex-none rounded object-cover"
          />
        ) : (
          <div className="flex h-[60px] w-[40px] flex-none items-center justify-center rounded bg-neutral-100 text-[9px] font-bold text-neutral-500">
            표지<br />없음
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-primary-900">{selected.title}</p>
          {selected.authors && (
            <p className="truncate text-xs text-neutral-500">{selected.authors}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onClear}
          className="flex-none text-xs font-bold text-neutral-400 underline"
        >
          연결 해제
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleSearch()
            }
          }}
          placeholder="책 제목으로 검색"
          className={inputClassName}
          style={inputStyle}
        />
        <button
          type="button"
          onClick={handleSearch}
          disabled={searching || !query.trim()}
          className="flex-none rounded-[var(--radius-md)] bg-primary-600 px-4 text-sm font-bold text-white disabled:bg-neutral-200 disabled:text-neutral-400"
        >
          {searching ? '검색 중' : '검색'}
        </button>
      </div>

      {error && <p className="mt-2 text-xs font-semibold text-accent-500">{error}</p>}

      {searched && results.length === 0 && !error && (
        <p className="mt-2 text-xs text-neutral-500">검색 결과가 없어요</p>
      )}

      {results.length > 0 && (
        <ul
          className="mt-2 max-h-64 divide-y divide-surface-200 overflow-y-auto rounded-[var(--radius-md)]"
          style={{ border: '1px solid var(--color-surface-300)' }}
        >
          {results.map((b, i) => {
            const key = b.isbn13 ?? `${b.title}-${i}`
            return (
              <li key={key}>
                <button
                  type="button"
                  disabled={picking !== null}
                  onClick={() => handlePick(b, key)}
                  className="flex w-full items-center gap-3 p-2.5 text-left hover:bg-surface-100 disabled:opacity-60"
                >
                  {b.thumbnail ? (
                    <img
                      src={b.thumbnail}
                      alt={b.title}
                      width={32}
                      height={48}
                      className="h-12 w-8 flex-none rounded object-cover"
                    />
                  ) : (
                    <div className="h-12 w-8 flex-none rounded bg-neutral-100" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-primary-900">
                      {b.title}
                    </span>
                    <span className="block truncate text-xs text-neutral-500">
                      {[b.authors, b.publisher].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className="flex-none text-xs font-bold text-primary-600">
                    {picking === key ? '연결 중' : '선택'}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
