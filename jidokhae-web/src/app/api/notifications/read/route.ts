import { NextResponse, type NextRequest } from 'next/server'
import { getRouteUser } from '@/lib/api-auth'
import { markAllRead } from '@/lib/app-notifications'

export async function POST(request: NextRequest) {
  const user = await getRouteUser(request)
  if (!user) {
    return NextResponse.json(
      { status: 'error', message: '로그인이 필요합니다' },
      { status: 401 },
    )
  }
  await markAllRead(user.id)
  return NextResponse.json({ status: 'success' })
}
