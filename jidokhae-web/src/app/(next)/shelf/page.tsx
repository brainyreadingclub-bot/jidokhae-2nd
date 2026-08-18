import Link from 'next/link'
import { getUser } from '@/lib/auth'
import { getMyLibrary } from '@/lib/library'
import { Sec } from '@/components/next/TossUI'
import type { LibraryEntryWithBook } from '@/types/book'

/**
 * 서재 탭 — "나의 책장" (2026-08-18 v3: 플랫 개인 기록).
 * 가장 최근에 담은 책이 히어로 + 출처 라벨, 아래는 표지 3열 그리드.
 * 데이터는 기존 library lib 재사용, 담기·관리는 마이페이지가 담당.
 * next_ui를 켜는 날 library_enabled도 함께 켠다 (스펙 §8 의존성).
 */

function sourceLabel(e: LibraryEntryWithBook): string {
  if (e.source === 'ask' && e.source_meeting_date) {
    return `${Number(e.source_meeting_date.slice(5, 7))}월 모임에서`
  }
  return e.source === 'ask' ? '모임에서' : '직접 담았어요'
}

export default async function ShelfPage() {
  const user = await getUser()
  const entries = user ? await getMyLibrary(user.id) : []
  const recent = entries[0] ?? null

  return (
    <div className="pt-2">
      <h1 className="mt-3 text-[21px] font-extrabold leading-[1.3] tracking-[-0.03em] text-tg-900">
        내 서재,
        <br />
        <span className="text-brand">{entries.length}권</span> 쌓였어요
      </h1>

      {entries.length === 0 ? (
        <div className="mt-6 rounded-[18px] border border-dashed border-tg-300 p-6 text-center">
          <p className="text-sm font-bold text-tg-700">아직 담은 책이 없어요</p>
          <p className="mt-1 text-xs text-tg-600">
            모임 다음날 알림에서 읽은 책을 담을 수 있어요
          </p>
        </div>
      ) : (
        <>
          {/* 가장 최근에 담은 책 — 히어로 */}
          {recent && (
            <div className="mt-5 flex items-center gap-4 rounded-[20px] bg-tg-50 p-4">
              {recent.books.thumbnail ? (
                <img
                  src={recent.books.thumbnail}
                  alt={recent.books.title}
                  width={72}
                  height={108}
                  className="h-[108px] w-[72px] flex-none rounded-[5px] object-cover"
                  style={{ boxShadow: '0 0 0 1px rgba(0,0,0,.05), 0 4px 12px rgba(25,31,40,.14)' }}
                />
              ) : (
                <div className="flex h-[108px] w-[72px] flex-none items-center justify-center rounded-[5px] bg-tg-100 p-1.5 text-center text-[10px] font-bold text-tg-600">
                  {recent.books.title}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold tracking-[.05em] text-tg-500">
                  가장 최근에 담은 책
                </p>
                <p className="mt-1 truncate text-base font-extrabold tracking-tight">
                  {recent.books.title}
                </p>
                <span className="mt-2 inline-block rounded-full bg-brand-bg px-2.5 py-1 text-[10.5px] font-extrabold text-brand-deep">
                  {sourceLabel(recent)}
                </span>
              </div>
            </div>
          )}

          <Sec aside="담은 순">모든 책</Sec>
          <div className="mt-2 grid grid-cols-3 gap-x-3 gap-y-4">
            {entries.map((e) => (
              <div key={e.id}>
                {e.books.thumbnail ? (
                  <img
                    src={e.books.thumbnail}
                    alt={e.books.title}
                    width={104}
                    height={156}
                    className="aspect-[2/3] w-full rounded-[6px] object-cover"
                    style={{ boxShadow: '0 0 0 1px rgba(0,0,0,.05), 0 4px 11px rgba(25,31,40,.14)' }}
                  />
                ) : (
                  <div className="flex aspect-[2/3] w-full items-center justify-center rounded-[6px] bg-tg-100 p-2 text-center text-xs font-bold text-tg-600">
                    {e.books.title}
                  </div>
                )}
                <p className="mt-1.5 truncate text-[11px] font-bold tracking-tight">
                  {e.books.title}
                </p>
                <p className="truncate text-[10px] font-semibold text-tg-500">
                  {sourceLabel(e)}
                </p>
              </div>
            ))}
          </div>
        </>
      )}

      <Link
        href="/my"
        className="mt-6 flex min-h-[48px] items-center justify-center rounded-[14px] bg-tg-100 text-sm font-bold text-tg-700"
      >
        책 담기 · 관리는 마이페이지에서
      </Link>
    </div>
  )
}
