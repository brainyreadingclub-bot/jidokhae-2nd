'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type MeetingValues = {
  title: string
  date: string
  time: string
  location: string
  capacity: string
  fee: string
}

type Props = {
  mode: 'create' | 'edit'
  meetingId?: string
  initialValues?: Partial<MeetingValues>
  confirmedCount?: number
}

const defaultValues: MeetingValues = {
  title: '',
  date: '',
  time: '',
  location: '',
  capacity: '',
  fee: '',
}

export default function MeetingForm({ mode, meetingId, initialValues, confirmedCount = 0 }: Props) {
  const router = useRouter()
  const [values, setValues] = useState<MeetingValues>({
    ...defaultValues,
    ...initialValues,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleChange(field: keyof MeetingValues, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // Validation
    if (!values.title.trim()) return setError('모임명을 입력해주세요')
    if (!values.date) return setError('날짜를 선택해주세요')
    if (!values.time) return setError('시간을 선택해주세요')
    if (!values.location.trim()) return setError('장소를 입력해주세요')

    const capacity = parseInt(values.capacity, 10)
    if (!capacity || capacity < 1) return setError('정원은 1명 이상이어야 합니다')
    if (mode === 'edit' && capacity < confirmedCount) {
      return setError(`현재 신청자(${confirmedCount}명)보다 적은 정원은 설정할 수 없습니다`)
    }

    const fee = parseInt(values.fee, 10)
    if (isNaN(fee) || fee < 0) return setError('참가비는 0원 이상이어야 합니다')

    setIsSubmitting(true)

    const supabase = createClient()
    const meetingData = {
      title: values.title.trim(),
      date: values.date,
      time: values.time,
      location: values.location.trim(),
      capacity,
      fee,
    }

    if (mode === 'create') {
      const { error: insertError } = await supabase
        .from('meetings')
        .insert({ ...meetingData, status: 'active' })

      if (insertError) {
        setError('모임 등록에 실패했습니다. 다시 시도해주세요.')
        setIsSubmitting(false)
        return
      }

      router.push('/admin')
      router.refresh()
    } else {
      const { error: updateError } = await supabase
        .from('meetings')
        .update(meetingData)
        .eq('id', meetingId!)

      if (updateError) {
        setError('수정에 실패했습니다. 다시 시도해주세요.')
        setIsSubmitting(false)
        return
      }

      router.push(`/meetings/${meetingId}`)
      router.refresh()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Field label="모임명" required>
        <input
          type="text"
          value={values.title}
          onChange={(e) => handleChange('title', e.target.value)}
          placeholder="독서모임 제목"
          className="w-full rounded-[var(--radius-md)] border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-300 focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="날짜" required>
          <input
            type="date"
            value={values.date}
            onChange={(e) => handleChange('date', e.target.value)}
            className="w-full rounded-[var(--radius-md)] border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
          />
        </Field>
        <Field label="시간" required>
          <input
            type="time"
            value={values.time}
            onChange={(e) => handleChange('time', e.target.value)}
            className="w-full rounded-[var(--radius-md)] border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
          />
        </Field>
      </div>

      <Field label="장소" required>
        <input
          type="text"
          value={values.location}
          onChange={(e) => handleChange('location', e.target.value)}
          placeholder="모임 장소"
          className="w-full rounded-[var(--radius-md)] border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-300 focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="정원" required>
          <input
            type="number"
            min="1"
            value={values.capacity}
            onChange={(e) => handleChange('capacity', e.target.value)}
            placeholder="14"
            className="w-full rounded-[var(--radius-md)] border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-300 focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
          />
        </Field>
        <Field label="참가비 (원)" required>
          <input
            type="number"
            min="0"
            step="1000"
            value={values.fee}
            onChange={(e) => handleChange('fee', e.target.value)}
            placeholder="10000"
            className="w-full rounded-[var(--radius-md)] border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-300 focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
          />
        </Field>
      </div>

      {error && (
        <p className="text-sm text-error">{error}</p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-[var(--radius-md)] bg-primary-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-600 active:bg-primary-700 disabled:opacity-50"
      >
        {isSubmitting
          ? mode === 'create'
            ? '등록 중...'
            : '수정 중...'
          : mode === 'create'
            ? '모임 등록'
            : '수정 완료'}
      </button>
    </form>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-gray-600">
        {label}
        {required && <span className="text-error ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}
