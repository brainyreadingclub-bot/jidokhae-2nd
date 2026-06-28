'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import RegionPicker from '@/components/RegionPicker'

type NicknameLock = 'changed' | 'pending' | null

type Props = {
  nickname: string
  realName: string | null
  phone: string | null
  region: string[] | null
  email: string | null
  nicknameLock: NicknameLock
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
}

const LOCK_ICON = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="inline align-[-1px]">
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
)

export default function ProfileEditor({ nickname, realName, phone, region, email, nicknameLock }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const [form, setForm] = useState({
    nickname,
    phone: phone ? formatPhone(phone) : '',
    regions: region || ([] as string[]),
    email: email || '',
  })

  function startEdit() {
    setForm({
      nickname,
      phone: phone ? formatPhone(phone) : '',
      regions: region || [],
      email: email || '',
    })
    setApiError(null)
    setEditing(true)
  }

  function cancelEdit() {
    setApiError(null)
    setEditing(false)
  }

  async function handleSave() {
    setSaving(true)
    setApiError(null)
    try {
      const res = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: form.nickname.trim(),
          phone: form.phone.replace(/\D/g, ''),
          region: form.regions,
          email: form.email.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.status !== 'success') {
        setApiError(data.message || '저장에 실패했습니다')
        setSaving(false)
        return
      }
      setEditing(false)
      setSaving(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      router.refresh()
    } catch {
      setApiError('네트워크 오류가 발생했습니다. 다시 시도해주세요.')
      setSaving(false)
    }
  }

  const heading = (
    <h2 className="mb-3 text-xl font-extrabold text-neutral-800 tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
      내 정보
    </h2>
  )

  // ── 보기 모드 ──
  if (!editing) {
    const rows: { label: string; value: string; locked?: boolean }[] = [
      { label: '닉네임', value: nickname },
      { label: '실명', value: realName || '-', locked: true },
      { label: '전화', value: phone ? formatPhone(phone) : '-' },
      { label: '지역', value: region && region.length > 0 ? region.join(', ') : '-' },
      { label: '이메일', value: email || '-' },
    ]
    return (
      <section>
        {heading}
        <div className="rounded-[var(--radius-md)] border border-neutral-200 bg-surface-50 px-4 shadow-[var(--shadow-sm)]">
          {rows.map((row, i) => (
            <div
              key={row.label}
              className={`flex items-center py-3 ${i < rows.length - 1 ? 'border-b border-neutral-200' : ''}`}
            >
              <span className="w-16 shrink-0 text-caption text-neutral-500">{row.label}</span>
              <span className="flex-1 text-sm font-semibold text-neutral-800">
                {row.value}
                {row.locked && <span className="ml-1.5 text-neutral-400">{LOCK_ICON}</span>}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex justify-end">
          <button
            onClick={startEdit}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-primary-600 hover:text-primary-700 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
            수정하기
          </button>
        </div>
        {saved && <p className="mt-2 text-right text-caption text-primary-600">저장되었습니다</p>}
      </section>
    )
  }

  // ── 편집 모드 ──
  const inputClassName =
    'w-full rounded-[var(--radius-md)] px-3.5 py-3 text-sm font-medium text-primary-900 placeholder:text-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-400/40 transition-shadow'
  const inputStyle = { backgroundColor: 'var(--color-surface-50)', border: '1px solid var(--color-surface-300)' }
  const lockedInputStyle = { backgroundColor: 'var(--color-surface-100)', border: '1px solid var(--color-neutral-200)' }

  const nicknameHint =
    nicknameLock === 'changed'
      ? '닉네임은 1회만 변경할 수 있어요.'
      : nicknameLock === 'pending'
        ? '입금 확인이 끝난 뒤 변경할 수 있어요.'
        : '닉네임은 1회만 변경할 수 있어요. 신중히 입력해 주세요.'

  return (
    <section>
      {heading}
      <div className="rounded-[var(--radius-md)] border border-primary-100 bg-surface-50 p-4 shadow-[var(--shadow-sm)] space-y-4">
        {/* 닉네임 */}
        <div>
          <label className="mb-2 block text-xs font-bold text-primary-700 tracking-tight">닉네임</label>
          <input
            type="text"
            value={form.nickname}
            onChange={(e) => setForm((p) => ({ ...p, nickname: e.target.value }))}
            disabled={nicknameLock !== null}
            maxLength={20}
            className={inputClassName}
            style={nicknameLock !== null ? lockedInputStyle : inputStyle}
          />
          <p className={`mt-1.5 text-xs ${nicknameLock !== null ? 'text-accent-600' : 'text-neutral-500'}`}>
            {nicknameLock !== null && <span className="mr-1">{LOCK_ICON}</span>}
            {nicknameHint}
          </p>
        </div>

        {/* 실명 (읽기전용) */}
        <div>
          <label className="mb-2 block text-xs font-bold text-primary-700 tracking-tight">실명</label>
          <input type="text" value={realName || ''} disabled className={inputClassName} style={lockedInputStyle} />
          <p className="mt-1.5 text-xs text-accent-600">
            <span className="mr-1">{LOCK_ICON}</span>
            실명 변경은 운영진에게 문의해 주세요.
          </p>
        </div>

        {/* 전화번호 */}
        <div>
          <label className="mb-2 block text-xs font-bold text-primary-700 tracking-tight">전화번호</label>
          <input
            type="tel"
            inputMode="numeric"
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: formatPhone(e.target.value) }))}
            placeholder="010-0000-0000"
            maxLength={13}
            className={inputClassName}
            style={inputStyle}
          />
        </div>

        {/* 지역 */}
        <RegionPicker regions={form.regions} onChange={(regions) => setForm((p) => ({ ...p, regions }))} />

        {/* 이메일 */}
        <div>
          <label className="mb-2 block text-xs font-bold text-primary-700 tracking-tight">이메일 (선택)</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            placeholder="email@example.com"
            className={inputClassName}
            style={inputStyle}
          />
        </div>

        {apiError && (
          <div
            className="rounded-[var(--radius-md)] px-4 py-3 text-sm font-medium text-error"
            style={{ backgroundColor: 'rgba(196, 61, 61, 0.06)', border: '1px solid rgba(196, 61, 61, 0.15)' }}
          >
            {apiError}
          </div>
        )}

        <div className="flex gap-2.5 pt-1">
          <button
            onClick={cancelEdit}
            disabled={saving}
            className="flex-1 rounded-[var(--radius-md)] border border-neutral-300 bg-white py-3 text-sm font-bold text-neutral-600 transition-colors hover:bg-neutral-50 disabled:opacity-40"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 rounded-[var(--radius-md)] bg-primary-600 py-3 text-sm font-bold text-white transition-colors hover:bg-primary-700 disabled:opacity-40"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </section>
  )
}
