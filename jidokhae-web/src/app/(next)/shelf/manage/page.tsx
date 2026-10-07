import { getUser } from '@/lib/auth'
import { getMyLibrary } from '@/lib/library'
import BackLink from '@/components/next/BackLink'
import BookSearchInput from '@/components/library/BookSearchInput'
import LibraryGrid from '@/components/library/LibraryGrid'
import LibraryToastProvider from '@/components/library/LibraryToast'

/**
 * 서재 탭 → 책 담기 · 관리. 서재가 구 `/my#library`로 내보내던 자리다.
 *
 * **담기와 관리를 한 화면에 함께 둔다** — 담기만 옮기고 완독·빼기가 구 화면에
 * 남으면 회원이 또 마이페이지로 튕긴다 (`DECISIONS.md` 2026-09-19 "분리 금지").
 *
 * 🔴 이것은 그 결정이 말하는 「서재 탭 단일화」 개편이 **아니다.** 그쪽은 시안 13장이
 * 딸린 작업이고 켜는 날 이후로 보류돼 있다. 여기서는 **넘어가는 경험만** 없앤다 —
 * 쓰는 부품(`BookSearchInput`·`LibraryGrid`)도 구 화면 것 그대로다.
 *
 * `LibrarySection`을 통째로 쓰지 않은 이유 — 그쪽에는 콜드스타트 B안 게이트가 있어
 * 책 0권 + 물어보기 없음이면 **아무것도 안 그린다**(2026-07-31 결정). 그 규칙은
 * "묻지 않았는데 서재를 들이밀지 않는다"는 뜻이라, 회원이 **직접 눌러 들어온**
 * 이 화면에 적용하면 빈 화면이 나온다.
 *
 * 🔴 구 `/my#library`는 지우지 않는다 (플래그 OFF 롤백 경로).
 */
export default async function ShelfManagePage() {
  const user = await getUser()
  const entries = user ? await getMyLibrary(user.id) : []

  return (
    <div className="pt-1">
      <BackLink href="/shelf" label="책 담기 · 관리" />

      <LibraryToastProvider>
        <h2 className="mt-4 text-[13.5px] font-bold tracking-tight text-tg-600">책 담기</h2>
        <div className="mt-2">
          <BookSearchInput />
        </div>

        <h2 className="mt-7 text-[13.5px] font-bold tracking-tight text-tg-600">
          담은 책 {entries.length}권
        </h2>
        {entries.length === 0 ? (
          <p className="mt-2 break-keep text-[13px] text-tg-600">
            아직 담은 책이 없어요. 위에서 검색해 담으면 여기 쌓여요.
          </p>
        ) : (
          <div className="mt-3">
            <LibraryGrid entries={entries} />
          </div>
        )}
      </LibraryToastProvider>
    </div>
  )
}
