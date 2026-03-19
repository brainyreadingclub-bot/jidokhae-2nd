'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  nickname: string
  email: string | null
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
}

const REGIONS = ['경주', '포항', '울산', '부산', '대구', '창원', '대전', '광주', '전주', '수원', '인천', '서울', '제주'] as const

export default function ProfileSetup({ nickname, email }: Props) {
  const router = useRouter()
  const [form, setForm] = useState({
    nickname: nickname || '',
    phone: '',
    regions: [] as string[],
    email: email || '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  const displayName = nickname || '회원'

  const isFormValid =
    form.nickname.trim().length >= 2 &&
    form.nickname.trim().length <= 20 &&
    /^010\d{7,8}$/.test(form.phone.replace(/\D/g, '')) &&
    form.regions.length > 0

  function validate(): boolean {
    const newErrors: Record<string, string> = {}

    const trimmed = form.nickname.trim()
    if (trimmed.length < 2 || trimmed.length > 20) {
      newErrors.nickname = '닉네임은 2~20자로 입력해주세요'
    }

    const phoneDigits = form.phone.replace(/\D/g, '')
    if (!/^010\d{7,8}$/.test(phoneDigits)) {
      newErrors.phone = '010으로 시작하는 휴대폰 번호를 입력해주세요'
    }

    if (form.regions.length === 0) {
      newErrors.region = '지역을 하나 이상 선택해주세요'
    }

    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      newErrors.email = '올바른 이메일 주소를 입력해주세요'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return

    setIsSubmitting(true)
    setApiError(null)

    try {
      const res = await fetch('/api/profile/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: form.nickname.trim(),
          phone: form.phone.replace(/\D/g, ''),
          region: form.regions,
          email: form.email.trim() || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setApiError(data.message || '프로필 저장에 실패했습니다')
        setIsSubmitting(false)
        return
      }

      router.refresh()
    } catch {
      setApiError('네트워크 오류가 발생했습니다. 다시 시도해주세요.')
      setIsSubmitting(false)
    }
  }

  const inputClassName =
    'w-full rounded-[var(--radius-md)] px-3.5 py-3 text-sm font-medium text-primary-900 placeholder:text-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-400/40 transition-shadow'

  const inputStyle = {
    backgroundColor: 'var(--color-surface-50)',
    border: '1px solid var(--color-surface-300)',
  }

  return (
    <div
      className="fixed inset-0 z-[60] overflow-y-auto animate-[fadeIn_0.4s_ease-out]"
      style={{
        backgroundColor: 'var(--color-neutral-50)',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="flex min-h-full items-center justify-center px-8 py-12">
        <div className="w-full max-w-xs">
        {/* 헤드카피 */}
        <div className="text-center mb-6">
          <h1 className="font-display text-xl font-bold text-primary-900">
            {displayName}님, 반갑습니다!
          </h1>
          <p className="mt-2 font-sans text-sm text-neutral-500">
            모임 안내와 리마인드 알림을 위해
            <br />
            아래 정보를 입력해주세요.
          </p>
        </div>

        {/* 폼 */}
        <div className="space-y-4">
          {/* 닉네임 */}
          <div>
            <label className="mb-2 block text-xs font-bold text-primary-700 tracking-tight">
              닉네임<span className="text-accent-500 ml-0.5">*</span>
            </label>
            <input
              type="text"
              value={form.nickname}
              onChange={(e) => setForm((prev) => ({ ...prev, nickname: e.target.value }))}
              placeholder="닉네임"
              maxLength={20}
              className={inputClassName}
              style={inputStyle}
            />
            {errors.nickname && (
              <p className="mt-1 text-xs text-error">{errors.nickname}</p>
            )}
          </div>

          {/* 전화번호 */}
          <div>
            <label className="mb-2 block text-xs font-bold text-primary-700 tracking-tight">
              전화번호<span className="text-accent-500 ml-0.5">*</span>
            </label>
            <input
              type="tel"
              inputMode="numeric"
              value={form.phone}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, phone: formatPhone(e.target.value) }))
              }
              placeholder="010-0000-0000"
              maxLength={13}
              className={inputClassName}
              style={inputStyle}
            />
            {errors.phone && (
              <p className="mt-1 text-xs text-error">{errors.phone}</p>
            )}
          </div>

          {/* 지역 */}
          <div>
            <label className="mb-2 block text-xs font-bold text-primary-700 tracking-tight">
              주로 참여할 지역 (복수 선택 가능)<span className="text-accent-500 ml-0.5">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {REGIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setForm((prev) => ({
                    ...prev,
                    regions: prev.regions.includes(r)
                      ? prev.regions.filter((v) => v !== r)
                      : [...prev.regions, r],
                  }))}
                  className={`py-2.5 rounded-[var(--radius-md)] text-sm transition-colors ${
                    form.regions.includes(r)
                      ? 'bg-primary-50 border-primary-500 text-primary-700 font-bold'
                      : 'bg-surface-50 border-neutral-200 text-neutral-500'
                  }`}
                  style={{
                    border: `1px solid ${
                      form.regions.includes(r)
                        ? 'var(--color-primary-500)'
                        : 'var(--color-neutral-200)'
                    }`,
                    backgroundColor:
                      form.regions.includes(r)
                        ? 'var(--color-primary-50)'
                        : 'var(--color-surface-50)',
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
            {errors.region && (
              <p className="mt-1 text-xs text-error">{errors.region}</p>
            )}
          </div>

          {/* 이메일 */}
          <div>
            <label className="mb-2 block text-xs font-bold text-primary-700 tracking-tight">
              이메일 (선택)
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="email@example.com"
              className={inputClassName}
              style={inputStyle}
            />
            {errors.email && (
              <p className="mt-1 text-xs text-error">{errors.email}</p>
            )}
          </div>
        </div>

        {/* API 에러 */}
        {apiError && (
          <div
            className="mt-4 rounded-[var(--radius-md)] px-4 py-3 text-sm font-medium text-error"
            style={{
              backgroundColor: 'rgba(196, 61, 61, 0.06)',
              border: '1px solid rgba(196, 61, 61, 0.15)',
            }}
          >
            {apiError}
          </div>
        )}

        {/* CTA */}
        <button
          onClick={handleSubmit}
          disabled={!isFormValid || isSubmitting}
          className="mt-6 w-full py-3.5 bg-primary-600 text-white font-semibold rounded-[var(--radius-md)] transition-colors hover:bg-primary-700 active:bg-primary-800 disabled:opacity-40 disabled:pointer-events-none"
        >
          {isSubmitting ? '저장 중...' : '시작하기'}
        </button>
        </div>
      </div>
    </div>
  )
}
