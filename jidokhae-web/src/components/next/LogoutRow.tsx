'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ModalOverlay from '@/components/ui/ModalOverlay'

/**
 * 5탭 「나」 탭 맨 아래 로그아웃 + 확인 모달 (2026-09-19 A2 시안 02·03).
 *
 * - 로그아웃 동작은 구 화면 `LogoutButton`과 **같다** — `signOut()` 후 `/auth/login`.
 *   새 로그아웃 경로를 만들지 않는다.
 * - 확인 모달은 기존 `ui/ModalOverlay`(ESC · 포커스 복귀 · 배경 블러) 재사용.
 * - 색: 그린(「진행하세요」)도 코럴(긴급·에러)도 쓰지 않는다. 로그아웃은 그 둘 중 무엇도 아니고,
 *   위험 색을 여기 쓰면 진짜 위험한 확인에 쓸 색이 없어진다.
 */
export default function LogoutRow() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  async function handleLogout() {
    if (isLoading) return
    setIsLoading(true)

    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/auth/login')
    } catch {
      setIsLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 flex h-12 items-center text-[13px] font-bold text-tg-600"
      >
        <span className="underline decoration-tg-300 underline-offset-2">로그아웃</span>
      </button>

      {open && (
        <ModalOverlay onClose={isLoading ? undefined : () => setOpen(false)}>
          <h2 className="text-[17px] font-extrabold tracking-tight text-tg-900">
            로그아웃할까요?
          </h2>
          <p className="mt-2 break-keep text-[13.5px] leading-relaxed text-tg-600">
            다시 들어올 때는 카카오 로그인 한 번이면 돼요.
          </p>
          <div className="mt-5 flex gap-[9px]">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={isLoading}
              className="flex h-12 flex-1 items-center justify-center rounded-[14px] bg-tg-100 text-sm font-bold tracking-tight text-tg-800 disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoading}
              className="flex h-12 flex-1 items-center justify-center rounded-[14px] bg-tg-800 text-sm font-bold tracking-tight text-white disabled:opacity-50"
            >
              {isLoading ? '로그아웃 중...' : '로그아웃'}
            </button>
          </div>
        </ModalOverlay>
      )}
    </>
  )
}
