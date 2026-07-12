import { getUser } from '@/lib/auth'
import { isLibraryEnabled, getMyLibrary } from '@/lib/library'
import LibraryGrid from '@/components/library/LibraryGrid'
import BookSearchInput from '@/components/library/BookSearchInput'

export default async function LibrarySection() {
  if (!(await isLibraryEnabled())) return null

  const user = await getUser()
  if (!user) return null

  const entries = await getMyLibrary(user.id)

  return (
    <section className="mt-8">
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

      {entries.length === 0 ? (
        <div className="mt-3 rounded-[var(--radius-md)] bg-surface-50 border border-dashed border-neutral-300 p-4">
          <p className="text-sm text-neutral-600 break-keep">
            다녀온 모임 책이 여기 쌓여요. 나중에 &ldquo;그 책 뭐였지&rdquo; 할 때 여기서 찾으세요.
          </p>
          <div className="mt-3">
            <BookSearchInput />
          </div>
        </div>
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
    </section>
  )
}
