import { getSiteSettings } from '@/lib/site-settings'
import { createClient } from '@/lib/supabase/server'
import LoginClient from '@/components/LoginClient'

export default async function LoginPage() {
  const settings = await getSiteSettings()
  const supabase = await createClient()
  const { data: memberCount } = await supabase.rpc('get_member_count')
  return <LoginClient settings={settings} memberCount={memberCount ?? null} />
}
