'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { VALID_REGIONS } from '@/lib/regions'

type Props = {
  currentRegion: string
  basePath: string // e.g. '/admin/meetings'
}

/**
 * 지역 필터 select. onChange 시 URL query string 갱신.
 * filter 같은 다른 query param은 유지.
 */
export default function RegionFilter({ currentRegion, basePath }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function handleChange(value: string) {
    const next = new URLSearchParams(searchParams.toString())
    if (value === 'all') next.delete('region')
    else next.set('region', value)
    const qs = next.toString()
    router.push(qs ? `${basePath}?${qs}` : basePath)
  }

  return (
    <div className="ml-auto flex items-center gap-2">
      <label htmlFor="region-filter" className="text-xs font-semibold text-primary-500">
        지역
      </label>
      <select
        id="region-filter"
        value={currentRegion}
        onChange={(e) => handleChange(e.target.value)}
        className="rounded-full border border-surface-300 bg-surface-50 px-3 py-1.5 text-xs font-medium text-primary-800 focus:outline-none focus:ring-2 focus:ring-primary-400/40"
      >
        <option value="all">전체</option>
        {VALID_REGIONS.map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>
    </div>
  )
}
