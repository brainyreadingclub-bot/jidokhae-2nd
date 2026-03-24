'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ModalOverlay from '@/components/ui/ModalOverlay'
import type { Venue } from '@/types/venue'

type Props = {
  venues: Venue[]
}

type VenueForm = {
  name: string
  settlement_type: 'percentage' | 'fixed' | 'none'
  settlement_rate: string
  settlement_fixed: string
  contact_name: string
  contact_info: string
}

const emptyForm: VenueForm = {
  name: '',
  settlement_type: 'percentage',
  settlement_rate: '80',
  settlement_fixed: '0',
  contact_name: '',
  contact_info: '',
}

const inputClassName =
  'w-full rounded-[var(--radius-md)] px-3.5 py-3 text-sm font-medium text-primary-900 placeholder:text-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-400/40 transition-shadow'

const inputStyle = {
  backgroundColor: 'var(--color-surface-50)',
  border: '1px solid var(--color-surface-300)',
}

export default function VenueManager({ venues }: Props) {
  const router = useRouter()
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; venueId?: string } | null>(null)
  const [form, setForm] = useState<VenueForm>(emptyForm)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activeVenues = venues.filter((v) => v.status === 'active')
  const inactiveVenues = venues.filter((v) => v.status === 'inactive')

  function openCreate() {
    setForm(emptyForm)
    setError(null)
    setModal({ mode: 'create' })
  }

  function openEdit(venue: Venue) {
    setForm({
      name: venue.name,
      settlement_type: venue.settlement_type,
      settlement_rate: String(venue.settlement_rate),
      settlement_fixed: String(venue.settlement_fixed),
      contact_name: venue.contact_name ?? '',
      contact_info: venue.contact_info ?? '',
    })
    setError(null)
    setModal({ mode: 'edit', venueId: venue.id })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!form.name.trim()) return setError('공간 이름을 입력해주세요')

    setIsSubmitting(true)

    const body = {
      name: form.name.trim(),
      settlement_type: form.settlement_type,
      settlement_rate: parseInt(form.settlement_rate, 10) || 80,
      settlement_fixed: parseInt(form.settlement_fixed, 10) || 0,
      contact_name: form.contact_name.trim() || null,
      contact_info: form.contact_info.trim() || null,
    }

    try {
      const url = modal?.mode === 'edit'
        ? `/api/admin/venues/${modal.venueId}`
        : '/api/admin/venues'

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.message || '저장에 실패했습니다')
      } else {
        setModal(null)
        router.refresh()
      }
    } catch {
      setError('저장에 실패했습니다')
    }

    setIsSubmitting(false)
  }

  async function handleToggleStatus(venue: Venue) {
    const newStatus = venue.status === 'active' ? 'inactive' : 'active'
    await fetch(`/api/admin/venues/${venue.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    router.refresh()
  }

  function renderVenueRow(venue: Venue) {
    const typeLabel = venue.settlement_type === 'percentage'
      ? `${venue.settlement_rate}%`
      : venue.settlement_type === 'fixed'
        ? `${venue.settlement_fixed?.toLocaleString('ko-KR')}원/회`
        : '없음'

    return (
      <div
        key={venue.id}
        className={`flex items-center justify-between px-3 py-3 ${venue.status === 'inactive' ? 'opacity-50' : ''}`}
        style={{ borderBottom: '1px solid var(--color-surface-200)' }}
      >
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-primary-800 truncate">{venue.name}</div>
          <div className="text-xs text-primary-500/70 mt-0.5">정산: {typeLabel}</div>
        </div>
        <div className="ml-3 shrink-0 flex items-center gap-2">
          <button
            onClick={() => openEdit(venue)}
            className="text-xs text-primary-600 hover:text-primary-700"
          >
            수정
          </button>
          <button
            onClick={() => handleToggleStatus(venue)}
            className={`text-xs ${venue.status === 'active' ? 'text-neutral-400 hover:text-error' : 'text-primary-600 hover:text-primary-700'}`}
          >
            {venue.status === 'active' ? '비활성화' : '활성화'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold text-primary-500 tracking-tight">공간 목록</h3>
        <button
          onClick={openCreate}
          className="text-xs font-bold text-primary-600 hover:text-primary-700"
        >
          + 공간 추가
        </button>
      </div>

      {venues.length === 0 ? (
        <p className="text-sm text-primary-400 text-center py-6">등록된 공간이 없습니다</p>
      ) : (
        <div
          className="rounded-[var(--radius-md)] overflow-hidden"
          style={{ border: '1px solid var(--color-surface-300)', backgroundColor: 'var(--color-surface-50)' }}
        >
          {activeVenues.map(renderVenueRow)}
          {inactiveVenues.map(renderVenueRow)}
        </div>
      )}

      {modal && (
        <ModalOverlay onClose={() => setModal(null)}>
          <form onSubmit={handleSubmit}>
            <p className="text-sm font-bold text-primary-900 mb-4">
              {modal.mode === 'create' ? '공간 추가' : '공간 수정'}
            </p>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-bold text-primary-700">이름 <span className="text-accent-500">*</span></label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="공간 이름"
                  className={inputClassName}
                  style={inputStyle}
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold text-primary-700">정산 유형</label>
                <select
                  value={form.settlement_type}
                  onChange={(e) => setForm((p) => ({ ...p, settlement_type: e.target.value as VenueForm['settlement_type'] }))}
                  className={inputClassName}
                  style={inputStyle}
                >
                  <option value="percentage">비율 (%)</option>
                  <option value="fixed">고정 금액 (원/회)</option>
                  <option value="none">정산 없음</option>
                </select>
              </div>

              {form.settlement_type === 'percentage' && (
                <div>
                  <label className="mb-2 block text-xs font-bold text-primary-700">정산율 (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={form.settlement_rate}
                    onChange={(e) => setForm((p) => ({ ...p, settlement_rate: e.target.value }))}
                    className={inputClassName}
                    style={inputStyle}
                  />
                </div>
              )}

              {form.settlement_type === 'fixed' && (
                <div>
                  <label className="mb-2 block text-xs font-bold text-primary-700">고정 금액 (원)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.settlement_fixed}
                    onChange={(e) => setForm((p) => ({ ...p, settlement_fixed: e.target.value }))}
                    className={inputClassName}
                    style={inputStyle}
                  />
                </div>
              )}

              <div>
                <label className="mb-2 block text-xs font-bold text-primary-700">담당자</label>
                <input
                  type="text"
                  value={form.contact_name}
                  onChange={(e) => setForm((p) => ({ ...p, contact_name: e.target.value }))}
                  placeholder="담당자 이름"
                  className={inputClassName}
                  style={inputStyle}
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold text-primary-700">연락처</label>
                <input
                  type="text"
                  value={form.contact_info}
                  onChange={(e) => setForm((p) => ({ ...p, contact_info: e.target.value }))}
                  placeholder="전화번호 또는 이메일"
                  className={inputClassName}
                  style={inputStyle}
                />
              </div>
            </div>

            {error && (
              <div
                className="mt-4 rounded-[var(--radius-md)] px-4 py-3 text-sm font-medium text-error"
                style={{
                  backgroundColor: 'rgba(196, 61, 61, 0.06)',
                  border: '1px solid rgba(196, 61, 61, 0.15)',
                }}
              >
                {error}
              </div>
            )}

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="flex-1 rounded-[var(--radius-md)] py-2.5 text-sm font-medium text-primary-600 transition-colors hover:bg-primary-50"
                style={{ border: '1px solid var(--color-surface-300)' }}
              >
                취소
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 rounded-[var(--radius-md)] py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-700 disabled:bg-neutral-200 disabled:text-neutral-400"
                style={{ backgroundColor: isSubmitting ? undefined : 'var(--color-primary-600)' }}
              >
                {isSubmitting ? '저장 중...' : '저장'}
              </button>
            </div>
          </form>
        </ModalOverlay>
      )}
    </>
  )
}
