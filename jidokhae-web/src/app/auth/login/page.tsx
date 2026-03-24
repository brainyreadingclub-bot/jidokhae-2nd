import { getSiteSettings } from '@/lib/site-settings'
import LoginClient from '@/components/LoginClient'

export default async function LoginPage() {
  const settings = await getSiteSettings()
  return <LoginClient settings={settings} />
}
