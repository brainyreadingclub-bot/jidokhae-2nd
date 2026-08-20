import { getUser } from '@/lib/auth'
import { isLibraryEnabled, getMyLibrary } from '@/lib/library'
import { getPendingAsk } from '@/lib/asks'
import LibraryGrid from '@/components/library/LibraryGrid'
import BookSearchInput from '@/components/library/BookSearchInput'
import LibraryToastProvider from '@/components/library/LibraryToast'

export default async function LibrarySection() {
  if (!(await isLibraryEnabled())) return null

  const user = await getUser()
  if (!user) return null

  const entries = await getMyLibrary(user.id)

  // 콜드스타트 정책(2026-07-30 확정, B안): 담을 계기가 없는 회원에게 빈 서재는 노이즈다.
  // 책이 0권이고 물어보기도 안 떠 있으면 섹션 자체를 렌더하지 않는다 — 회원의 서재는
  // "모임 다녀온 다음 날 물어보기가 뜨는 순간"부터 시작한다. 그때 AskStrip이 맥락을
  // 만들고 바로 아래 서재가 "담으면 여기 쌓인다"의 목적지로 처음 등장한다.
  //
  // strip을 닫으면(dismissed → getPendingAsk가 null) 서재도 함께 사라진다. "안 담겠다"는
  // 회원의 의사를 존중하는 것이므로 의도된 동작이다.
  // getPendingAsk는 React cache()로 감싸져 있어 AskStripSection과 쿼리를 공유한다.
  if (entries.length === 0 && !(await getPendingAsk(user.id))) return null

  return (
    // id: 서재 탭 "책 담기·관리" 버튼이 /my#library로 바로 붙는다 (개인정보 섹션 건너뛰기)
    <section id="library" className="mt-8 scroll-mt-4">
      <div className="flex items-baseline gap-2">
        <h2
          className="text-lg font-extrabold text-neutral-800 tracking-tight"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          내 서재
        </h2>
        {entries.length > 0 && (
          <span className="text-caption text-neutral-600">{entries.length}권</span>
        )}
      </div>

      <LibraryToastProvider>
        {entries.length === 0 ? (
          <>
            <p className="mt-1 text-sm text-neutral-600 break-keep">
              모임에서 읽은 책이 여기 쌓여요.
            </p>
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-semibold text-primary-600 list-none">
                + 책 검색해서 담기
              </summary>
              <div className="mt-2">
                <BookSearchInput />
              </div>
            </details>
          </>
        ) : (
          <>
            <div className="mt-3">
              <LibraryGrid entries={entries} />
            </div>
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-semibold text-primary-600 list-none">
                + 책 검색해서 담기
              </summary>
              <div className="mt-2">
                <BookSearchInput />
              </div>
            </details>
          </>
        )}
      </LibraryToastProvider>
    </section>
  )
}
