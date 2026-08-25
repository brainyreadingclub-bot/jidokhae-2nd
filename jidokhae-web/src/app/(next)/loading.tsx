/**
 * `(next)` 라우트 그룹 로딩 경계 — 스켈레톤.
 * 없으면 서버 조회가 끝날 때까지 **빈 화면**이 보인다 (2026-08-25 조사 §2-4).
 */
export default function NextLoading() {
  return (
    <div className="pt-4" aria-busy="true" aria-label="불러오는 중">
      <div className="h-7 w-2/3 animate-pulse rounded-[8px] bg-tg-100" />
      <div className="mt-3 h-7 w-1/2 animate-pulse rounded-[8px] bg-tg-100" />
      <div className="mt-6 h-[92px] animate-pulse rounded-[20px] bg-tg-100" />
      <div className="mt-3 h-[92px] animate-pulse rounded-[20px] bg-tg-100" />
      <div className="mt-6 h-4 w-24 animate-pulse rounded-[6px] bg-tg-100" />
      <div className="mt-3 h-[60px] animate-pulse rounded-[14px] bg-tg-100" />
      <div className="mt-2 h-[60px] animate-pulse rounded-[14px] bg-tg-100" />
    </div>
  )
}
