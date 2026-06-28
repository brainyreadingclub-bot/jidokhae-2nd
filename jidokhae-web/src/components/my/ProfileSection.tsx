import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth'
import { getProfile } from '@/lib/profile'
import ProfileEditor from '@/components/my/ProfileEditor'

export default async function ProfileSection() {
  const user = await getUser()
  if (!user) redirect('/auth/login')

  const supabase = await createClient()
  const [profile, pendingResult] = await Promise.all([
    getProfile(user.id),
    supabase
      .from('registrations')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'pending_transfer')
      .limit(1),
  ])

  const hasPendingTransfer = !!(pendingResult.data && pendingResult.data.length > 0)

  // 잠금 우선순위: 이미 변경(영구) > 입금 대기(임시)
  const nicknameLock: 'changed' | 'pending' | null =
    profile.nickname_changed_at !== null ? 'changed' : hasPendingTransfer ? 'pending' : null

  return (
    <ProfileEditor
      nickname={profile.nickname}
      realName={profile.real_name}
      phone={profile.phone}
      region={profile.region}
      email={profile.email}
      nicknameLock={nicknameLock}
    />
  )
}
