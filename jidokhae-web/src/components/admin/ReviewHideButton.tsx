'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ModalOverlay from '@/components/ui/ModalOverlay'

/**
 * 공개 소감 「내리기」 / 「내림 풀기」 (시안 A2). admin만 — API가 최종 방어선.
 * 내리면 회원이 다시 공개하지 못한다. 풀어도 공개로 돌아가지 않는다(다시 공개할지는 회원이 정한다).
 */
export default function ReviewHideButton({
  reviewId,
  nickname,
  action,
}: {
  reviewId: string
  nickname: string
  action: 'hide' | 'unhide'
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/reviews/hide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId, action }),
      })
      const json = await res.json().catch(() => null)
      if (json?.status !== 'success') throw new Error(json?.message ?? 'failed')
      setOpen(false)
      router.refresh()
    } catch {
      setError('처리하지 못했어요. 다시 눌러 주세요.')
    } finally {
      setBusy(false)
    }
  }

  const hide = action === 'hide'
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 flex-none items-center whitespace-nowrap rounded-lg border border-neutral-300 bg-white px-3 text-xs font-bold text-neutral-800 hover:bg-neutral-50"
      >
        {hide ? '내리기' : '내림 풀기'}
      </button>
      {open && (
        <ModalOverlay onClose={() => !busy && setOpen(false)}>
          <div className="p-5">
            <h3 className="text-base font-bold text-neutral-900">
              {hide ? `${nickname}님 소감을 모임 소개에서 내릴까요?` : '내림을 풀까요?'}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600 break-keep">
              {hide
                ? '바로 모임 소개에서 사라진다. 회원은 「운영자가 내림」으로 보고, 다시 공개할 수 없다.'
                : '공개로 돌아가지는 않는다. 회원이 「내가 남긴 후기」에서 다시 공개할 수 있게 될 뿐이다.'}
            </p>
            {error && <p className="mt-2 text-sm font-semibold text-accent-500">{error}</p>}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={busy}
                className="h-11 flex-1 rounded-[var(--radius-md)] border border-neutral-200 text-sm font-semibold text-neutral-700"
              >
                그대로 두기
              </button>
              <button
                type="button"
                onClick={run}
                disabled={busy}
                className="h-11 flex-1 rounded-[var(--radius-md)] bg-primary-600 text-sm font-bold text-white disabled:opacity-60"
              >
                {busy ? '처리 중' : hide ? '내리기' : '내림 풀기'}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </>
  )
}
