import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth'
import { getProfile } from '@/lib/profile'
import MemberList from '@/components/admin/MemberList'

export default async function MembersPage() {
  const supabase = await createClient()
  const user = await getUser()
  if (!user) redirect('/auth/login')

  const profile = await getProfile(user.id)
  if (profile.role !== 'admin' && profile.role !== 'editor') redirect('/')

  // 역할별 SELECT 분기 (Phase 3 M7 Step 2.5, 검토문서 §3.2)
  // editor에게는 phone/email을 서버에서 아예 보내지 않음.
  // UI에서만 숨기면 React DevTools/네트워크 탭으로 노출 가능.
  // Supabase 타입 파서는 리터럴 문자열만 추론하므로 두 분기를 분리한다.
  type ProfileRow = {
    id: string
    nickname: string
    real_name: string | null
    role: string
    region: string[] | null
    profile_completed_at: string | null
    phone?: string | null
    email?: string | null
    created_at: string
    is_staff: boolean
  }

  let profiles: ProfileRow[]
  if (profile.role === 'admin') {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, nickname, real_name, role, region, profile_completed_at, phone, email, created_at, is_staff')
      .order('created_at', { ascending: false })
    if (error) throw new Error(`회원 목록 조회 실패: ${error.message}`)
    profiles = (data ?? []) as ProfileRow[]
  } else {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, nickname, real_name, role, region, profile_completed_at, created_at, is_staff')
      .order('created_at', { ascending: false })
    if (error) throw new Error(`회원 목록 조회 실패: ${error.message}`)
    profiles = (data ?? []) as ProfileRow[]
  }

  return (
    <div className="px-5 pt-6 pb-10 lg:px-10 lg:pt-10">
      <div className="mb-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-500">
          회원
        </div>
        <h1
          className="mt-1 text-2xl font-extrabold tracking-tight text-primary-900 lg:text-3xl"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          회원 관리
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          회원 목록과 역할, 스텝 자격을 관리합니다.
        </p>
      </div>
      <MemberList
        profiles={profiles}
        currentUserId={user.id}
        viewerRole={profile.role as 'admin' | 'editor'}
      />
    </div>
  )
}
