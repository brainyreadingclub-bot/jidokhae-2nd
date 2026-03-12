'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LogoutButton() {
  const router = useRouter()
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
    <button
      onClick={handleLogout}
      disabled={isLoading}
      className="text-xs text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
    >
      {isLoading ? '로그아웃 중...' : '로그아웃'}
    </button>
  )
}
