'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { commentPublicState, reviewMeetingLabel } from '@/lib/review-rules'
import type { MyReviewListItem } from '@/lib/review'

/**
 * 내가 남긴 후기 목록 (시안 15) + 「공개 그만하기」 확인 시트 (시안 16).
 * 공개하기는 바로, 내리기는 한 번 묻는다 — 내리면 바로 모임 소개에서 사라진다.
 */
export default function MyReviewsList({ items }: { items: MyReviewListItem[] }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState<MyReviewListItem | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function toggle(item: MyReviewListItem, publish: boolean) {
    setBusyId(item.id)
    setError(null)
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: publish ? 'publish' : 'unpublish', meetingId: item.meeting_id }),
      })
      const json = await res.json().catch(() => null)
      if (json?.status !== 'success') {
        setError(json?.data?.reason === 'hidden' ? '운영자가 공개를 내린 소감이에요.' : '바꾸지 못했어요. 다시 눌러 주세요.')
        return
      }
      setConfirming(null)
      router.refresh()
    } catch {
      setError('바꾸지 못했어요. 다시 눌러 주세요.')
    } finally {
      setBusyId(null)
    }
  }

  if (items.length === 0) {
    return (
      <div className="mt-24 px-3 text-center">
        <div className="mx-auto flex h-[52px] w-[52px] items-center justify-center rounded-[17px] bg-tg-100 text-[22px]" aria-hidden>
          💬
        </div>
        <p className="mt-3.5 text-base font-extrabold text-tg-900">아직 남긴 후기가 없어요</p>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-tg-600">정기모임 다음 날 후기를 여쭤볼게요.</p>
      </div>
    )
  }

  return (
    <>
      {error && !confirming && (
        <p role="alert" className="mt-3 text-[13px] font-semibold text-warnx">
          {error}
        </p>
      )}
      <ul className="mt-3.5">
        {items.map((item) => {
          const state = commentPublicState(item)
          const tag =
            state === 'public'
              ? '공개 중'
              : state === 'admin_hidden'
                ? '운영자가 내림'
                : state === 'none'
                  ? '소감 없음'
                  : '운영자만'
          return (
            <li key={item.id} className="border-t border-tg-100 py-4 first:border-t-0">
              <div className="flex items-center justify-between gap-2.5">
                <b className="text-sm font-extrabold tracking-tight text-tg-900">
                  {reviewMeetingLabel(item.meeting.date, item.meeting.region, false)}
                </b>
                <span className={`flex-none text-xs font-bold ${state === 'public' ? 'text-brand-deep' : 'text-tg-600'}`}>
                  {tag}
                </span>
              </div>
              {item.comment ? (
                <p className="mt-[7px] text-[14.5px] leading-relaxed text-tg-800 break-keep">{item.comment}</p>
              ) : (
                <p className="mt-1.5 text-[13px] text-tg-500">표정만 남겼어요.</p>
              )}
              {state === 'admin_hidden' && (
                <p className="mt-1.5 text-[13px] text-tg-500">운영자가 모임 소개에서 내렸어요.</p>
              )}
              {(state === 'public' || state === 'private' || state === 'member_unpublished') && (
                <div className="mt-2.5 flex gap-2">
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => (state === 'public' ? setConfirming(item) : toggle(item, true))}
                    className={`inline-flex min-h-[34px] items-center rounded-[10px] px-[13px] text-[13px] font-bold disabled:opacity-50 ${
                      state === 'public' ? 'bg-tg-100 text-tg-700' : 'bg-brand-bg text-brand-deep'
                    }`}
                  >
                    {busyId === item.id ? '바꾸는 중' : state === 'public' ? '공개 그만하기' : '공개하기'}
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {confirming && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end bg-[rgba(25,31,40,0.42)]" role="dialog" aria-modal="true" aria-label="모임 소개에서 내릴까요?">
          <button type="button" className="flex-1" aria-label="닫기" onClick={() => setConfirming(null)} />
          <div
            className="mx-auto w-full max-w-screen-sm rounded-t-[22px] bg-white px-5 pt-2.5"
            style={{ paddingBottom: 'calc(18px + env(safe-area-inset-bottom, 0px))' }}
          >
            <div className="mx-auto mb-3.5 h-1 w-[38px] rounded-full bg-tg-200" aria-hidden />
            <h3 className="text-[19px] font-extrabold tracking-[-0.03em] text-tg-900">모임 소개에서 내릴까요?</h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-tg-600 break-keep">
              바로 모임 소개에서 사라지고, 운영자만 보는 소감으로 남아요. 다시 공개할 수도 있어요.
            </p>
            {error && (
              <p role="alert" className="mt-3 text-[13px] font-semibold text-warnx">
                {error}
              </p>
            )}
            <button
              type="button"
              disabled={busyId === confirming.id}
              onClick={() => toggle(confirming, false)}
              className="mt-5 flex min-h-[52px] w-full items-center justify-center rounded-[14px] bg-brand text-[15px] font-extrabold text-white disabled:opacity-60"
            >
              {busyId === confirming.id ? '내리는 중' : '내리기'}
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null)
                setConfirming(null)
              }}
              className="mt-1 flex min-h-[44px] w-full items-center justify-center text-sm font-bold text-tg-600"
            >
              그대로 두기
            </button>
          </div>
        </div>
      )}
    </>
  )
}
