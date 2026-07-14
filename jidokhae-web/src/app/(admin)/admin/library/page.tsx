import { isLibraryEnabled } from '@/lib/library'
import { getAskStats } from '@/lib/asks'

export default async function AdminLibraryPage() {
  const enabled = await isLibraryEnabled()

  if (!enabled) {
    return (
      <div>
        <h1 className="text-xl font-extrabold text-neutral-800 tracking-tight">서재 응답률</h1>
        <p className="mt-4 text-sm text-neutral-600">
          서재 기능이 꺼져 있습니다. (site_settings.library_enabled = on)
        </p>
      </div>
    )
  }

  const stats = await getAskStats()

  const cards: { label: string; value: string; hint?: string }[] = [
    { label: '물어보기 응답률', value: `${stats.responseRate}%`, hint: '담음 ÷ 정기 참여(최근 60일)' },
    { label: '정기 참여(분모)', value: `${stats.denominator}건` },
    { label: '담음(응답)', value: `${stats.answered}건` },
    { label: '닫음', value: `${stats.dismissed}건` },
    { label: '노출·미응답', value: `${stats.viewed}건`, hint: '봤지만 안 담고 안 닫음' },
    { label: '미노출', value: `${stats.unexposed}건`, hint: '아직 물어보기 안 뜬 참여' },
  ]

  return (
    <div>
      <h1 className="text-xl font-extrabold text-neutral-800 tracking-tight">서재 응답률</h1>
      <p className="mt-1 text-caption text-neutral-500">
        북극성: 물어보기 응답률 · 폐기선: 4주 내 참여자 30% 미응답
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-[var(--radius-md)] border border-neutral-200 bg-white p-4">
            <p className="text-caption text-neutral-500">{c.label}</p>
            <p className="mt-1 text-2xl font-extrabold text-neutral-800">{c.value}</p>
            {c.hint && <p className="mt-1 text-[11px] text-neutral-400 break-keep">{c.hint}</p>}
          </div>
        ))}
      </div>

      <p className="mt-4 text-[11px] text-neutral-400 break-keep">
        노출·미응답 = 물어보기를 봤지만 담지도 닫지도 않은 참여. 노출 경로(마이페이지 / 모임 상세)별 세부는 GA4 이벤트(ask_strip_view의 entry_point)에서 확인.
      </p>
    </div>
  )
}
