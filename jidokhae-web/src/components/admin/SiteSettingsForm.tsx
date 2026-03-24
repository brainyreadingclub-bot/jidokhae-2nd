'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  settings: Record<string, string>
}

const FIELDS = [
  { section: '사이트 정보', fields: [
    { key: 'member_count', label: '회원 수', type: 'number' as const, placeholder: '250' },
    { key: 'active_regions_label', label: '활동 지역 표기', type: 'text' as const, placeholder: '경주 · 포항' },
  ]},
  { section: '사업자 정보', fields: [
    { key: 'company_name', label: '상호명', type: 'text' as const, placeholder: '지독해' },
    { key: 'representative', label: '대표자', type: 'text' as const, placeholder: '임재윤' },
    { key: 'business_number', label: '사업자등록번호', type: 'text' as const, placeholder: '000-00-00000' },
    { key: 'address', label: '주소', type: 'text' as const, placeholder: '주소' },
    { key: 'phone', label: '연락처', type: 'text' as const, placeholder: '0507-1396-7908' },
  ]},
  { section: '문의', fields: [
    { key: 'support_contact', label: '문의 안내 문구', type: 'text' as const, placeholder: '카카오톡 \'단무지\'에게 1:1 채팅으로 연락해 주세요.' },
  ]},
]

const inputClassName =
  'w-full rounded-[var(--radius-md)] px-3.5 py-3 text-sm font-medium text-primary-900 placeholder:text-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-400/40 transition-shadow'

const inputStyle = {
  backgroundColor: 'var(--color-surface-50)',
  border: '1px solid var(--color-surface-300)',
}

export default function SiteSettingsForm({ settings }: Props) {
  const router = useRouter()
  const [values, setValues] = useState<Record<string, string>>({ ...settings })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function handleChange(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }))
    setSuccess(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setIsSubmitting(true)

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: values }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.message || '저장에 실패했습니다')
      } else {
        setSuccess(true)
        router.refresh()
      }
    } catch {
      setError('저장에 실패했습니다')
    }

    setIsSubmitting(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {FIELDS.map(({ section, fields }) => (
        <div key={section}>
          <h3 className="text-xs font-bold text-primary-500 mb-4 tracking-tight">{section}</h3>
          <div className="space-y-4">
            {fields.map(({ key, label, type, placeholder }) => (
              <div key={key}>
                <label className="mb-2 block text-xs font-bold text-primary-700 tracking-tight">
                  {label}
                </label>
                <input
                  type={type}
                  value={values[key] ?? ''}
                  onChange={(e) => handleChange(key, e.target.value)}
                  placeholder={placeholder}
                  className={inputClassName}
                  style={inputStyle}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

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

      {success && (
        <div
          className="rounded-[var(--radius-md)] px-4 py-3 text-sm font-medium text-success"
          style={{
            backgroundColor: 'rgba(45, 125, 95, 0.06)',
            border: '1px solid rgba(45, 125, 95, 0.15)',
          }}
        >
          저장되었습니다
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-[var(--radius-md)] bg-primary-600 py-3.5 text-sm font-bold text-white tracking-wide transition-all hover:bg-primary-700 active:scale-[0.98] disabled:bg-neutral-200 disabled:text-neutral-400 disabled:cursor-not-allowed"
      >
        {isSubmitting ? '저장 중...' : '설정 저장'}
      </button>
    </form>
  )
}
