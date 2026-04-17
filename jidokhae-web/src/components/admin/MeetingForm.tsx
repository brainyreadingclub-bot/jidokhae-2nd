'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { VALID_REGIONS } from '@/lib/regions'

type MeetingValues = {
  title: string
  description: string
  date: string
  time: string
  venue_id: string
  location: string
  capacity: string
  fee: string
  region: string
  is_featured: boolean
}

type VenueOption = {
  id: string
  name: string
}

type Props = {
  mode: 'create' | 'edit'
  meetingId?: string
  initialValues?: Partial<MeetingValues>
  confirmedCount?: number
  venues?: VenueOption[]
}

function formatNumberInput(value: string): string {
  const num = value.replace(/[^0-9]/g, '')
  if (!num) return ''
  return Number(num).toLocaleString()
}

function parseNumberInput(value: string): string {
  return value.replace(/[^0-9]/g, '')
}

const defaultValues: MeetingValues = {
  title: '',
  description: '',
  date: '',
  time: '',
  venue_id: '',
  location: '',
  capacity: '',
  fee: '',
  region: '경주',
  is_featured: false,
}

export default function MeetingForm({ mode, meetingId, initialValues, confirmedCount = 0, venues = [] }: Props) {
  const router = useRouter()
  const [values, setValues] = useState<MeetingValues>({
    ...defaultValues,
    ...initialValues,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleChange<K extends keyof MeetingValues>(field: K, value: MeetingValues[K]) {
    setValues((prev) => ({ ...prev, [field]: value }))
  }

  function handleVenueChange(venueId: string) {
    if (venueId) {
      const venue = venues.find((v) => v.id === venueId)
      setValues((prev) => ({
        ...prev,
        venue_id: venueId,
        location: venue?.name ?? prev.location,
      }))
    } else {
      // "기타" 선택 — location 유지
      setValues((prev) => ({ ...prev, venue_id: '' }))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // Validation
    if (!values.title.trim()) return setError('모임명을 입력해주세요')
    if (!values.date) return setError('날짜를 선택해주세요')
    if (!values.time) return setError('시간을 선택해주세요')
    if (!values.location.trim()) return setError('장소를 입력해주세요')
    if (!VALID_REGIONS.includes(values.region as (typeof VALID_REGIONS)[number])) {
      return setError('지역을 선택해주세요')
    }

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
      description: values.description.trim() || null,
      date: values.date,
      time: values.time,
      location: values.location.trim(),
      venue_id: values.venue_id || null,
      capacity,
      fee,
      region: values.region,
      is_featured: values.is_featured,
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

      router.push('/admin/meetings')
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

      router.push(`/admin/meetings/${meetingId}`)
      router.refresh()
    }
  }

  const isFormComplete =
    values.title.trim() !== '' &&
    values.date !== '' &&
    values.time !== '' &&
    values.location.trim() !== '' &&
    values.capacity !== '' &&
    values.fee !== ''

  const isDisabled = isSubmitting || !isFormComplete

  const inputClassName =
    'w-full rounded-[var(--radius-md)] px-3.5 py-3 text-sm font-medium text-primary-900 placeholder:text-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-400/40 transition-shadow'

  const inputStyle = {
    backgroundColor: 'var(--color-surface-50)',
    border: '1px solid var(--color-surface-300)',
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Field label="모임명" required>
        <input
          type="text"
          value={values.title}
          onChange={(e) => handleChange('title', e.target.value)}
          placeholder="독서모임 제목"
          className={inputClassName}
          style={inputStyle}
        />
      </Field>

      <Field label="모임 소개">
        <textarea
          value={values.description}
          onChange={(e) => handleChange('description', e.target.value)}
          placeholder="모임에 대한 간단한 소개 (선택)"
          maxLength={1000}
          rows={3}
          className={`${inputClassName} resize-none`}
          style={inputStyle}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="날짜" required>
          <input
            type="date"
            value={values.date}
            onChange={(e) => handleChange('date', e.target.value)}
            className={inputClassName}
            style={inputStyle}
          />
        </Field>
        <Field label="시간" required>
          <input
            type="time"
            value={values.time}
            onChange={(e) => handleChange('time', e.target.value)}
            className={inputClassName}
            style={inputStyle}
          />
        </Field>
      </div>

      {venues.length > 0 && (
        <Field label="공간">
          <select
            value={values.venue_id}
            onChange={(e) => handleVenueChange(e.target.value)}
            className={inputClassName}
            style={inputStyle}
          >
            <option value="">기타 (직접 입력)</option>
            {venues.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </Field>
      )}

      <Field label="장소" required>
        <input
          type="text"
          value={values.location}
          onChange={(e) => handleChange('location', e.target.value)}
          placeholder="모임 장소"
          className={inputClassName}
          style={inputStyle}
        />
      </Field>

      <Field label="지역" required>
        <select
          value={values.region}
          onChange={(e) => handleChange('region', e.target.value)}
          className={inputClassName}
          style={inputStyle}
        >
          {VALID_REGIONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </Field>

      <div>
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={values.is_featured}
            onChange={(e) => handleChange('is_featured', e.target.checked)}
            className="h-4 w-4 rounded border-surface-300 text-accent-500 focus:ring-accent-400/40"
          />
          <span className="text-sm font-medium text-primary-800">
            인라인 PICK 배너로 노출
          </span>
        </label>
        <p className="mt-1 ml-[26px] text-xs text-primary-500/80">
          체크 시 모임 일정 탭에서 눈에 띄게 표시됩니다
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="정원" required>
          <input
            type="number"
            min="1"
            value={values.capacity}
            onChange={(e) => handleChange('capacity', e.target.value)}
            placeholder="12"
            className={inputClassName}
            style={inputStyle}
          />
        </Field>
        <Field label="참가비 (원)" required>
          <input
            type="text"
            inputMode="numeric"
            value={values.fee ? formatNumberInput(values.fee) : ''}
            onChange={(e) => handleChange('fee', parseNumberInput(e.target.value))}
            placeholder="12,000"
            className={inputClassName}
            style={inputStyle}
          />
        </Field>
      </div>

      {error && (
        <div
          className="rounded-[var(--radius-md)] px-4 py-3 text-sm font-medium text-error"
          style={{
            backgroundColor: 'rgba(196, 61, 61, 0.06)',
            border: '1px solid rgba(196, 61, 61, 0.15)',
          }}
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isDisabled}
        className="w-full rounded-[var(--radius-md)] bg-primary-600 py-3.5 text-sm font-bold text-white tracking-wide transition-all duration-[250ms] ease hover:bg-primary-700 active:scale-[0.98] disabled:bg-neutral-200 disabled:text-neutral-400 disabled:cursor-not-allowed disabled:shadow-none"
        style={{ boxShadow: isDisabled ? 'none' : 'var(--shadow-md)' }}
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
      <label className="mb-2 block text-xs font-bold text-primary-700 tracking-tight">
        {label}
        {required && <span className="text-accent-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}
