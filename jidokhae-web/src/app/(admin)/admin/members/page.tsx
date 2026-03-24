import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/profile'
import MemberList from '@/components/admin/MemberList'

export default async function MembersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const profile = await getProfile(user.id)
  if (profile.role !== 'admin' && profile.role !== 'editor') redirect('/')

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, nickname, real_name, role, region, profile_completed_at, phone, email, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`회원 목록 조회 실패: ${error.message}`)
  }

  return (
    <div className="px-5 pt-4 pb-6">
      <h1 className="text-lg font-extrabold text-primary-900 tracking-tight mb-5">
        회원 관리
      </h1>
      <MemberList
        profiles={(profiles ?? []) as { id: string; nickname: string; real_name: string | null; role: string; region: string[] | null; profile_completed_at: string | null; phone: string | null; email: string | null; created_at: string }[]}
        currentUserId={user.id}
        viewerRole={profile.role as 'admin' | 'editor'}
      />
    </div>
  )
}
