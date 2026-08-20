import { cache } from 'react'
import { getSiteSettings } from '@/lib/site-settings'
import { createServiceClient } from '@/lib/supabase/admin'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { BookSearchResult, LibraryEntryWithBook } from '@/types/book'

/**
 * 서재 기능 플래그. site_settings.library_enabled === 'on' 일 때만 노출.
 * LIBRARY_PREVIEW === 'on' env는 Vercel Preview 전용 우회(Production 미설정) —
 * DB 플래그를 켜지 않고 preview에서만 화면 검토용. prod 회원 노출 0.
 */
export async function isLibraryEnabled(): Promise<boolean> {
  if (process.env.LIBRARY_PREVIEW === 'on') return true
  const settings = await getSiteSettings()
  return settings.library_enabled === 'on'
}

/**
 * 회원 서재 조회. React cache()로 동일 요청 중복 방지.
 * anon 키가 아니라 service_role로 조회(서버 컴포넌트에서 user_id 직접 필터).
 */
export const getMyLibrary = cache(async (userId: string): Promise<LibraryEntryWithBook[]> => {
  const admin = createServiceClient()
  const { data } = await admin
    .from('library_entries')
    .select('*, books(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  const entries = (data ?? []) as LibraryEntryWithBook[]

  // source='ask' 항목의 출처 모임 날짜 붙이기 (라벨 "N월 정기모임에서")
  const meetingIds = Array.from(
    new Set(entries.filter((e) => e.source_meeting_id).map((e) => e.source_meeting_id as string)),
  )
  if (meetingIds.length > 0) {
    const { data: meetings } = await admin.from('meetings').select('id, date').in('id', meetingIds)
    const dateMap = new Map((meetings ?? []).map((m) => [m.id as string, m.date as string]))
    for (const e of entries) {
      e.source_meeting_date = e.source_meeting_id ? dateMap.get(e.source_meeting_id) ?? null : null
    }
  }

  return entries
})

/**
 * 책 upsert(isbn13 기준) — 있으면 재사용, 없으면 생성. 반환: book id 또는 null(실패).
 * 기존 책에 description이 비어 있고 새 검색 결과에 있으면 채워 넣는다 (구버전 데이터 보강).
 */
export async function upsertBook(
  admin: SupabaseClient,
  book: BookSearchResult,
): Promise<string | null> {
  if (book.isbn13) {
    const { data: existing } = await admin
      .from('books')
      .select('id, description')
      .eq('isbn13', book.isbn13)
      .maybeSingle()
    if (existing) {
      if (!existing.description && book.description) {
        await admin.from('books').update({ description: book.description }).eq('id', existing.id)
      }
      return existing.id
    }
  }

  const { data: inserted, error } = await admin
    .from('books')
    .insert({
      isbn13: book.isbn13,
      title: book.title,
      authors: book.authors,
      publisher: book.publisher,
      thumbnail: book.thumbnail,
      description: book.description ?? null,
    })
    .select('id')
    .single()
  if (error || !inserted) return null
  return inserted.id
}

/**
 * 책 upsert(isbn13 기준) + 서재 항목 insert.
 * isbn13이 있으면 기존 책 재사용, 없으면(희귀본) 매번 새 book 생성.
 * 이미 담은 책(user+book UNIQUE)이면 조용히 무시.
 * 반환: 'added' | 'already' | 'error'
 */
export async function upsertBookAndEntry(
  admin: SupabaseClient,
  userId: string,
  book: BookSearchResult,
  source: 'manual' | 'ask',
  sourceMeetingId: string | null,
): Promise<'added' | 'already' | 'error'> {
  // 1. 책 확보
  const bookId = await upsertBook(admin, book)
  if (!bookId) return 'error'

  // 2. 서재 항목 insert (중복이면 23505 → already)
  const { error: entryErr } = await admin.from('library_entries').insert({
    user_id: userId,
    book_id: bookId,
    source,
    source_meeting_id: sourceMeetingId,
  })

  if (entryErr) {
    if (entryErr.code === '23505') return 'already'
    return 'error'
  }
  return 'added'
}

/** 서재 항목 삭제(빼기). 본인 항목만. 반환: 삭제된 book 정보(undo용) 또는 null */
export async function removeEntry(
  admin: SupabaseClient,
  userId: string,
  entryId: string,
): Promise<{ title: string } | null> {
  const { data, error } = await admin
    .from('library_entries')
    .delete()
    .eq('id', entryId)
    .eq('user_id', userId)
    .select('id, books(title)')
  if (error || !data || data.length === 0) return null
  const row = data[0] as unknown as { books: { title: string } | null }
  return { title: row.books?.title ?? '책' }
}

/** 완독 토글. 본인 항목만. 반환: 성공 여부 */
export async function setCompleted(
  admin: SupabaseClient,
  userId: string,
  entryId: string,
  completed: boolean,
): Promise<boolean> {
  const { data, error } = await admin
    .from('library_entries')
    .update({ completed })
    .eq('id', entryId)
    .eq('user_id', userId)
    .select('id')
  return !error && !!data && data.length > 0
}
