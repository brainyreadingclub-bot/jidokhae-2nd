import Image from 'next/image'
import Link from 'next/link'
import { getUser } from '@/lib/auth'
import { getMyLibrary } from '@/lib/library'
import { Sec } from '@/components/next/TossUI'

/**
 * 서재 탭 — 기존 library lib 재사용 (전면개편 스펙 §6: 기존 기능의 자리 이동).
 * 물어보기(책 담기) 흐름은 기존 마이페이지 컴포넌트가 담당 — 여기는 조회 중심.
 * next_ui를 켜는 날 library_enabled도 함께 켠다 (스펙 §8 의존성).
 */
export default async function ShelfPage() {
  const user = await getUser()
  const entries = user ? await getMyLibrary(user.id) : []

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
          <Sec aside={`${entries.length}권`}>담은 책</Sec>
          <div className="mt-2 grid grid-cols-3 gap-3">
            {entries.map((e) => (
              <div key={e.id}>
                {e.books.thumbnail ? (
                  <Image
                    src={e.books.thumbnail}
                    alt={e.books.title}
                    width={104}
                    height={150}
                    className="h-[150px] w-full rounded-[9px] object-cover"
                    style={{ boxShadow: '0 5px 12px rgba(25,31,40,.16)' }}
                  />
                ) : (
                  <div className="flex h-[150px] w-full items-center justify-center rounded-[9px] bg-tg-100 p-2 text-center text-xs font-bold text-tg-600">
                    {e.books.title}
                  </div>
                )}
                <p className="mt-1.5 truncate text-[11px] font-bold tracking-tight">
                  {e.books.title}
                </p>
                <p className="truncate text-[10px] font-semibold text-tg-500">
                  {e.source === 'ask' ? '모임에서' : '직접 담음'}
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
