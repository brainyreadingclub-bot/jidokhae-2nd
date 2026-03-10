'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Props = {
  meetingId: string
  confirmedCount: number
}

export default function DeleteMeetingButton({
  meetingId,
  confirmedCount,
}: Props) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasRegistrations = confirmedCount > 0

  async function handleDelete() {
    if (hasRegistrations || isDeleting) return

    const confirmed = window.confirm('이 모임을 삭제하시겠습니까?')
    if (!confirmed) return

    setIsDeleting(true)
    setError(null)

    const supabase = createClient()
    const { error: deleteError } = await supabase
      .from('meetings')
      .update({ status: 'deleted' })
      .eq('id', meetingId)

    if (deleteError) {
      setError('삭제에 실패했습니다. 다시 시도해주세요.')
      setIsDeleting(false)
      return
    }

    router.push('/admin')
    router.refresh()
  }

  if (hasRegistrations) {
    return (
      <div>
        <button
          disabled
          className="w-full rounded-[var(--radius-md)] border border-gray-200 bg-gray-50 py-2.5 text-sm text-gray-400 cursor-not-allowed"
        >
          삭제
        </button>
        <p className="mt-1.5 text-xs text-gray-400 text-center">
          신청자가 있어 삭제할 수 없습니다
        </p>
      </div>
    )
  }

  return (
    <div>
      <button
        onClick={handleDelete}
        disabled={isDeleting}
        className="w-full rounded-[var(--radius-md)] border border-error/30 bg-white py-2.5 text-sm font-medium text-error transition-colors hover:bg-error/5 active:bg-error/10 disabled:opacity-50"
      >
        {isDeleting ? '삭제 중...' : '삭제'}
      </button>
      {error && (
        <p className="mt-1.5 text-xs text-error text-center">{error}</p>
      )}
    </div>
  )
}
