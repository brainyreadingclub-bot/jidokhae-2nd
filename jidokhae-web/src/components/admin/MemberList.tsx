'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ModalOverlay from '@/components/ui/ModalOverlay'

// Phase 3 M7 Step 2.5: phone/email은 admin 전용 필드로 서버에서 차단.
// editor의 Props에는 phone/email이 undefined로 전달됨.
type Profile = {
  id: string
  nickname: string
  real_name: string | null
  role: string
  region: string[] | null
  profile_completed_at: string | null
  phone?: string | null
  email?: string | null
  created_at: string
}

type Props = {
  profiles: Profile[]
  currentUserId: string
  viewerRole: 'admin' | 'editor'
}

const SECTIONS = [
  { key: 'admin', label: '운영자' },
  { key: 'editor', label: '운영진' },
  { key: 'member', label: '회원' },
] as const

export default function MemberList({ profiles, currentUserId, viewerRole }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filterIncomplete, setFilterIncomplete] = useState(false)
  const [filterNoPhone, setFilterNoPhone] = useState(false)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [modal, setModal] = useState<{ userId: string; nickname: string; newRole: string } | null>(null)

  // 필터링
  const filtered = profiles.filter((p) => {
    if (search) {
      const q = search.toLowerCase()
      const matchNick = (p.nickname || '').toLowerCase().includes(q)
      const matchName = (p.real_name || '').toLowerCase().includes(q)
      if (!matchNick && !matchName) return false
    }
    if (filterIncomplete && p.profile_completed_at) return false
    if (filterNoPhone && p.phone) return false
    return true
  })

  // 역할별 그룹화 + 섹션 내 정렬
  function getGroup(role: string) {
    return filtered
      .filter((p) => p.role === role)
      .sort((a, b) => {
        if (!a.profile_completed_at && b.profile_completed_at) return 1
        if (a.profile_completed_at && !b.profile_completed_at) return -1
        return (a.nickname || '').localeCompare(b.nickname || '', 'ko')
      })
  }

  async function handleRoleChange() {
    if (!modal) return
    setLoadingId(modal.userId)
    setModal(null)
    try {
      const res = await fetch('/api/admin/members/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: modal.userId, newRole: modal.newRole }),
      })
      if (!res.ok) {
        const data = await res.json()
        alert(data.message || '역할 변경에 실패했습니다')
      }
    } catch {
      alert('역할 변경에 실패했습니다')
    }
    setLoadingId(null)
    router.refresh()
  }

  function getDisplayName(p: Profile) {
    if (p.real_name) return `${p.real_name} (${p.nickname})`
    return p.nickname || '(미설정)'
  }

  function formatJoinDate(dateStr: string): string {
    const d = new Date(dateStr)
    return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`
  }

  function getRoleBadge(role: string, clickable: boolean) {
    const arrow = clickable ? ' ↕' : ''
    if (role === 'admin') {
      return (
        <span className="inline-flex items-center rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-bold text-primary-700" style={{ border: '1px solid var(--color-primary-200)' }}>
          운영자
        </span>
      )
    }
    if (role === 'editor') {
      return (
        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold text-accent-600" style={{ backgroundColor: 'var(--color-accent-50)', border: '1px solid var(--color-accent-200)' }}>
          운영진{arrow}
        </span>
      )
    }
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold text-neutral-500" style={{ backgroundColor: 'var(--color-neutral-100)', border: '1px solid var(--color-neutral-200)' }}>
        회원{arrow}
      </span>
    )
  }

  function renderRow(p: Profile) {
    const isSelf = p.id === currentUserId
    const isAdmin = p.role === 'admin'
    const isLoading = loadingId === p.id
    const canChange = viewerRole === 'admin' && !isSelf && !isAdmin

    return (
      <div
        key={p.id}
        className="flex items-center justify-between px-3 py-3"
        style={{ borderBottom: '1px solid var(--color-surface-200)' }}
      >
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-primary-800 truncate">
            {getDisplayName(p)}
            {(!p.profile_completed_at || !p.real_name) && (
              <span className="ml-1 text-[10px] text-warning">⚠ 미완성</span>
            )}
          </div>
          <div className="text-xs text-primary-500/70 mt-0.5 flex items-center gap-2">
            <span>{p.region && p.region.length > 0 ? p.region.join(', ') : '-'}</span>
            <span>·</span>
            <span>{formatJoinDate(p.created_at)}</span>
            {/* 전화번호: admin 전용 (editor에게는 서버에서 데이터 미전송, 표시 자체 생략) */}
            {viewerRole === 'admin' && p.phone && (
              <>
                <span>·</span>
                <span>{p.phone}</span>
              </>
            )}
          </div>
          {/* 이메일: admin 전용 */}
          {viewerRole === 'admin' && p.email && (
            <div className="text-xs text-primary-400 mt-0.5 truncate">{p.email}</div>
          )}
        </div>
        <div className="ml-3 shrink-0">
          {canChange ? (
            <button
              onClick={() => setModal({
                userId: p.id,
                nickname: getDisplayName(p),
                newRole: p.role === 'editor' ? 'member' : 'editor',
              })}
              disabled={isLoading}
              className="cursor-pointer transition-opacity hover:opacity-70 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="text-xs text-neutral-400">변경 중...</span>
              ) : (
                getRoleBadge(p.role, true)
              )}
            </button>
          ) : (
            getRoleBadge(p.role, false)
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      {/* 검색 */}
      <input
        type="text"
        placeholder="닉네임 또는 실명 검색"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full mb-3 px-4 py-2.5 rounded-[var(--radius-md)] text-sm outline-none transition-colors"
        style={{
          border: '1px solid var(--color-surface-300)',
          backgroundColor: 'var(--color-surface-50)',
        }}
      />

      {/* 필터 토글 */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setFilterIncomplete(!filterIncomplete)}
          className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
            filterIncomplete ? 'bg-primary-600 text-white' : 'text-primary-600 hover:bg-primary-50'
          }`}
          style={!filterIncomplete ? { border: '1px solid var(--color-surface-300)', backgroundColor: 'var(--color-surface-50)' } : undefined}
        >
          프로필 미완성
        </button>
        {/* 전화번호 미등록 필터: admin만 (editor는 phone 데이터를 받지 않음) */}
        {viewerRole === 'admin' && (
          <button
            onClick={() => setFilterNoPhone(!filterNoPhone)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
              filterNoPhone ? 'bg-primary-600 text-white' : 'text-primary-600 hover:bg-primary-50'
            }`}
            style={!filterNoPhone ? { border: '1px solid var(--color-surface-300)', backgroundColor: 'var(--color-surface-50)' } : undefined}
          >
            전화번호 미등록
          </button>
        )}
      </div>

      {/* 회원 수 */}
      <p className="text-xs text-neutral-500 mb-4">
        전체 {profiles.length}명 {(search || filterIncomplete || filterNoPhone) && `· 검색 결과 ${filtered.length}명`}
      </p>

      {/* 역할별 섹션 */}
      {filtered.length === 0 ? (
        <p className="text-sm text-primary-400 text-center py-8">
          검색 결과가 없습니다
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {SECTIONS.map(({ key, label }) => {
            const group = getGroup(key)
            if (group.length === 0) return null

            return (
              <div key={key}>
                {/* 섹션 헤더 */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-px flex-1" style={{ backgroundColor: 'var(--color-surface-300)' }} />
                  <span className="text-xs font-bold text-neutral-500 whitespace-nowrap">
                    {label} ({group.length}명)
                  </span>
                  <div className="h-px flex-1" style={{ backgroundColor: 'var(--color-surface-300)' }} />
                </div>

                {/* 멤버 리스트 */}
                <div
                  className="rounded-[var(--radius-md)] overflow-hidden"
                  style={{ border: '1px solid var(--color-surface-300)', backgroundColor: 'var(--color-surface-50)' }}
                >
                  {group.map((p) => renderRow(p))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 역할 변경 확인 모달 */}
      {modal && (
        <ModalOverlay onClose={() => setModal(null)}>
          <div className="text-center">
            <p className="text-sm font-bold text-primary-900 mb-2">
              역할 변경
            </p>
            <p className="text-sm text-primary-700 mb-6">
              {modal.newRole === 'editor'
                ? `${modal.nickname}님을 운영진으로 지정합니다. 모임 생성/수정 권한이 부여됩니다.`
                : `${modal.nickname}님의 운영진 권한을 해제합니다.`}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setModal(null)}
                className="flex-1 rounded-[var(--radius-md)] py-2.5 text-sm font-medium text-primary-600 transition-colors hover:bg-primary-50"
                style={{ border: '1px solid var(--color-surface-300)' }}
              >
                취소
              </button>
              <button
                onClick={handleRoleChange}
                className="flex-1 rounded-[var(--radius-md)] py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-700"
                style={{ backgroundColor: 'var(--color-primary-600)' }}
              >
                확인
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </>
  )
}
