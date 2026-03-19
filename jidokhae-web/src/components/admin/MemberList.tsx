'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ModalOverlay from '@/components/ui/ModalOverlay'

type Profile = {
  id: string
  nickname: string
  role: string
  region: string[] | null
  profile_completed_at: string | null
}

type Props = {
  profiles: Profile[]
  currentUserId: string
}

export default function MemberList({ profiles, currentUserId }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [modal, setModal] = useState<{ userId: string; nickname: string; newRole: string } | null>(null)

  // 정렬: editor → member → 프로필 미완성
  const sorted = [...profiles].sort((a, b) => {
    const order = (p: Profile) => {
      if (p.role === 'admin') return 0
      if (p.role === 'editor') return 1
      if (!p.profile_completed_at) return 3
      return 2
    }
    const diff = order(a) - order(b)
    if (diff !== 0) return diff
    return (a.nickname || '').localeCompare(b.nickname || '', 'ko')
  })

  const filtered = sorted.filter((p) => {
    if (!search) return true
    const displayName = p.nickname || '(미설정)'
    return displayName.includes(search)
  })

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
    if (!p.profile_completed_at) return p.nickname || '(미설정)'
    return p.nickname || '(미설정)'
  }

  function getRoleBadge(role: string) {
    if (role === 'admin') {
      return (
        <span className="inline-flex items-center rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-bold text-primary-700" style={{ border: '1px solid var(--color-primary-100)' }}>
          운영자
        </span>
      )
    }
    if (role === 'editor') {
      return (
        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold text-accent-600" style={{ backgroundColor: 'var(--color-accent-50)', border: '1px solid var(--color-accent-100)' }}>
          운영진
        </span>
      )
    }
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold text-neutral-500" style={{ backgroundColor: 'var(--color-surface-200)', border: '1px solid var(--color-surface-300)' }}>
        회원
      </span>
    )
  }

  return (
    <>
      {/* 검색 */}
      <input
        type="text"
        placeholder="닉네임 검색"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full mb-4 px-4 py-2.5 rounded-[var(--radius-md)] text-sm outline-none transition-colors"
        style={{
          border: '1px solid var(--color-surface-300)',
          backgroundColor: 'var(--color-surface-50)',
        }}
      />

      {/* 회원 수 */}
      <p className="text-xs text-neutral-500 mb-3">
        전체 {profiles.length}명 {search && `· 검색 결과 ${filtered.length}명`}
      </p>

      {/* 회원 목록 */}
      <div
        className="rounded-[var(--radius-md)] overflow-hidden"
        style={{ border: '1px solid var(--color-surface-300)' }}
      >
        {filtered.length === 0 ? (
          <p className="text-sm text-primary-400 text-center py-8">
            검색 결과가 없습니다
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-surface-300)', backgroundColor: 'var(--color-surface-100)' }}>
                <th className="px-3 py-2.5 text-left text-xs font-bold text-primary-500">닉네임</th>
                <th className="px-3 py-2.5 text-left text-xs font-bold text-primary-500">지역</th>
                <th className="px-3 py-2.5 text-right text-xs font-bold text-primary-500">역할</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const isSelf = p.id === currentUserId
                const isAdmin = p.role === 'admin'
                const isLoading = loadingId === p.id
                const canChange = !isSelf && !isAdmin

                return (
                  <tr
                    key={p.id}
                    style={{ borderBottom: '1px solid var(--color-surface-200)', backgroundColor: 'var(--color-surface-50)' }}
                    className="last:border-b-0"
                  >
                    <td className="px-3 py-3 text-sm font-medium text-primary-800">
                      <div>
                        {getDisplayName(p)}
                        {!p.profile_completed_at && (
                          <span className="ml-1 text-[10px] text-warning">⚠ 미완성</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-sm text-primary-500/70">
                      {p.region && p.region.length > 0 ? p.region.join(', ') : '-'}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {canChange ? (
                        <button
                          onClick={() => setModal({
                            userId: p.id,
                            nickname: getDisplayName(p),
                            newRole: p.role === 'editor' ? 'member' : 'editor',
                          })}
                          disabled={isLoading}
                          className="disabled:opacity-50"
                        >
                          {isLoading ? (
                            <span className="text-xs text-neutral-400">변경 중...</span>
                          ) : (
                            getRoleBadge(p.role)
                          )}
                        </button>
                      ) : (
                        getRoleBadge(p.role)
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

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
