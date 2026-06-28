'use client'

import { useState } from 'react'
import { VALID_REGIONS } from '@/lib/regions'

const PRIMARY_REGIONS: string[] = ['경주', '포항']
const OTHER_REGIONS = VALID_REGIONS.filter((r) => !PRIMARY_REGIONS.includes(r))

export default function RegionPicker({
  regions,
  onChange,
  error,
}: {
  regions: string[]
  onChange: (regions: string[]) => void
  error?: string
}) {
  const hasOtherSelected = regions.some((r) => (OTHER_REGIONS as readonly string[]).includes(r))
  const [showOthers, setShowOthers] = useState(hasOtherSelected)

  function toggleRegion(r: string) {
    onChange(
      regions.includes(r)
        ? regions.filter((v) => v !== r)
        : [...regions, r],
    )
  }

  const selectedStyle = {
    border: '1px solid var(--color-primary-500)',
    backgroundColor: 'var(--color-primary-50)',
  }
  const unselectedStyle = {
    border: '1px solid var(--color-neutral-200)',
    backgroundColor: 'var(--color-surface-50)',
  }

  return (
    <div>
      <label className="mb-2 block text-xs font-bold text-primary-700 tracking-tight">
        주로 참여할 지역 (복수 선택 가능)<span className="text-accent-500 ml-0.5">*</span>
      </label>

      {/* Primary regions — larger buttons */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        {PRIMARY_REGIONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => toggleRegion(r)}
            className={`relative py-3.5 rounded-[var(--radius-md)] text-sm font-medium transition-colors ${
              regions.includes(r)
                ? 'text-primary-700 font-bold'
                : 'text-neutral-500'
            }`}
            style={regions.includes(r) ? selectedStyle : unselectedStyle}
          >
            {r}
            {regions.includes(r) && (
              <svg className="absolute top-2 right-2 text-primary-500" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </button>
        ))}
      </div>

      {/* Toggle for other regions */}
      {!showOthers ? (
        <button
          type="button"
          onClick={() => setShowOthers(true)}
          className="w-full py-2 text-xs font-medium text-primary-400 hover:text-primary-600 transition-colors"
        >
          다른 지역 보기
          <svg className="inline ml-1" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            {OTHER_REGIONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => toggleRegion(r)}
                className={`py-2.5 rounded-[var(--radius-md)] text-sm transition-colors ${
                  regions.includes(r)
                    ? 'text-primary-700 font-bold'
                    : 'text-neutral-500'
                }`}
                style={regions.includes(r) ? selectedStyle : unselectedStyle}
              >
                {r}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowOthers(false)}
            className="mt-1 w-full py-2 text-xs font-medium text-primary-400 hover:text-primary-600 transition-colors"
          >
            접기
            <svg className="inline ml-1 rotate-180" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </>
      )}

      {error && (
        <p className="mt-1 text-xs text-error">{error}</p>
      )}
    </div>
  )
}
