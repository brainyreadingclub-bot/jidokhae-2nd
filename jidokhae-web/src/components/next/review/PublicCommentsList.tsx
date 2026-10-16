'use client'

import { useState } from 'react'
import { formatMonthDay } from '@/lib/kst'
import type { PublicComment } from '@/lib/review'

/** 최근 3개 + 「더 보기」 (시안 20). 닉네임 · 소감 · 모임 날짜만 — 표정·실명은 받지도 않는다 */
const FIRST = 3

export default function PublicCommentsList({ comments }: { comments: PublicComment[] }) {
  const [open, setOpen] = useState(false)
  const shown = open ? comments : comments.slice(0, FIRST)
  return (
    <section className="mt-6">
      <h3 className="text-[13.5px] font-bold tracking-tight text-tg-600">지난 모임에서 남긴 한 줄</h3>
      <ul className="mt-1">
        {shown.map((c, i) => (
          <li key={`${c.meeting_date}-${i}`} className="border-t border-tg-100 py-[13px] first:border-t-0">
            <p className="text-[14.5px] leading-relaxed text-tg-800 break-keep">{c.comment}</p>
            <span className="mt-1 block text-xs font-semibold text-tg-600">
              {c.nickname} · {formatMonthDay(c.meeting_date)} 모임
            </span>
          </li>
        ))}
      </ul>
      {!open && comments.length > FIRST && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-1 min-h-[36px] text-[13px] font-bold text-tg-600"
        >
          더 보기 ›
        </button>
      )}
    </section>
  )
}
