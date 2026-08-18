'use client'

import { useState } from 'react'

/**
 * 책 소개 (카카오 contents) — 3줄 접기, "더 보기"로 펼침.
 * 2026-08-13 신청 설계서 §5-4: 책 소개는 출판사의 것, 접어서 선정 이유를 앞세운다.
 */
export default function BookIntro({ description }: { description: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="mt-3 rounded-xl bg-neutral-50 px-4 py-3.5">
      <p className="text-[11px] font-bold text-neutral-500">책 소개</p>
      <p
        className={`mt-1 text-sm leading-relaxed text-neutral-700 break-keep ${
          open ? '' : 'line-clamp-3'
        }`}
      >
        {description}
      </p>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-1.5 text-xs font-bold text-neutral-500 underline"
        >
          더 보기
        </button>
      )}
    </div>
  )
}
