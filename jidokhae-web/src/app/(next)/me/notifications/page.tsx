import { getUser } from '@/lib/auth'
import { listAppNotifications } from '@/lib/app-notifications'
import NotificationList from '@/components/next/NotificationList'

export default async function NotificationsPage() {
  const user = await getUser()
  const items = user ? await listAppNotifications(user.id) : []

  return (
    <div>
      <h1 className="mt-4 text-[15px] font-extrabold tracking-tight text-tg-900">알림</h1>
      <NotificationList items={items} />
    </div>
  )
}
