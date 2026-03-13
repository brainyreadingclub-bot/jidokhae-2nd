import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { processPaymentConfirmation } from '@/lib/payment'

export async function POST(request: NextRequest) {
  // Authenticate user via Supabase session cookies
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll() {
          // No-op: API route doesn't need to set cookies
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { status: 'error', message: '로그인이 필요합니다' },
      { status: 401 },
    )
  }

  let body: {
    paymentKey?: string
    orderId?: string
    amount?: number
    meetingId?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { status: 'error', message: '잘못된 요청입니다' },
      { status: 400 },
    )
  }

  const { paymentKey, orderId, amount, meetingId } = body
  if (!paymentKey || !orderId || amount === undefined || !meetingId) {
    return NextResponse.json(
      { status: 'error', message: 'paymentKey, orderId, amount, meetingId가 필요합니다' },
      { status: 400 },
    )
  }

  const result = await processPaymentConfirmation(
    paymentKey,
    orderId,
    amount,
    meetingId,
    user.id,
  )

  const httpStatus = result.status === 'error' ? 500 : 200
  return NextResponse.json(result, { status: httpStatus })
}
