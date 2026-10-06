'use client'

import { useState } from 'react'
import type { SkinName } from '@/components/meetings/actionButtonSkin'

/**
 * 책 소개 (카카오 contents) — 3줄 접기, "더 보기"로 펼침.
 * 2026-08-13 신청 설계서 §5-4: 책 소개는 출판사의 것, 접어서 선정 이유를 앞세운다.
 */
export default function BookIntro({
  description,
  skin = 'legacy',
}: {
  description: string
  skin?: SkinName
}) {
  const [open, setOpen] = useState(false)
  const toss = skin === 'toss'

  return (
    <div className={toss ? 'mt-3 rounded-[18px] bg-tg-100 px-4 py-3.5' : 'mt-3 rounded-xl bg-neutral-50 px-4 py-3.5'}>
      <p className={`text-[11px] font-bold ${toss ? 'text-tg-600' : 'text-neutral-500'}`}>책 소개</p>
      <p
        className={`mt-1 text-sm leading-relaxed break-keep ${toss ? 'text-tg-700' : 'text-neutral-700'} ${
          open ? '' : 'line-clamp-3'
        }`}
      >
        {description}
      </p>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`mt-1.5 text-xs font-bold underline ${toss ? 'text-tg-600' : 'text-neutral-500'}`}
        >
          더 보기
        </button>
      )}
    </div>
  )
}
