import { NextResponse, type NextRequest } from 'next/server'
import { getRouteUser } from '@/lib/api-auth'
import { listAppNotifications, unreadCount } from '@/lib/app-notifications'

export async function GET(request: NextRequest) {
  const user = await getRouteUser(request)
  if (!user) {
    return NextResponse.json(
      { status: 'error', message: '로그인이 필요합니다' },
      { status: 401 },
    )
  }
  const [items, unread] = await Promise.all([
    listAppNotifications(user.id),
    unreadCount(user.id),
  ])
  return NextResponse.json({ status: 'success', data: { items, unread } })
}
