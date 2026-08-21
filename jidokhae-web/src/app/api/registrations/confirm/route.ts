import { NextResponse, after, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase/admin'
import { processPaymentConfirmation } from '@/lib/payment'
import { sendRegistrationConfirmNotification, sendWaitlistConfirmNotification } from '@/lib/notification'
import { sendMetaEvent, getClientIp, isMetaCapiEnabled } from '@/lib/meta-capi'

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
    paymentId?: string
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

  const { paymentId, meetingId } = body
  if (!paymentId || !meetingId) {
    return NextResponse.json(
      { status: 'error', message: 'paymentId, meetingId가 필요합니다' },
      { status: 400 },
    )
  }

  // 마케팅 계측용 요청 컨텍스트 — after() 안에서 request에 접근하면 안 되므로 미리 꺼낸다
  const clientIp = getClientIp(request.headers)
  const clientUserAgent = request.headers.get('user-agent')
  const fbp = request.cookies.get('_fbp')?.value ?? null
  const fbc = request.cookies.get('_fbc')?.value ?? null
  const referer = request.headers.get('referer')

  const result = await processPaymentConfirmation(
    paymentId,
    meetingId,
    user.id,
  )

  // 알림톡 — 실패해도 결제 응답에 영향 없음
  if (result.status === 'success') {
    try {
      await sendRegistrationConfirmNotification(meetingId, user.id, result.registrationId)
    } catch (error) {
      console.error('[confirm] 신청 완료 알림톡 발송 실패:', error)
    }
  } else if (result.status === 'waitlisted') {
    try {
      await sendWaitlistConfirmNotification(meetingId, user.id, result.registrationId)
    } catch (error) {
      console.error('[confirm] 대기 신청 알림톡 발송 실패:', error)
    }
  }

  const isPaid = result.status === 'success' || result.status === 'waitlisted'

  // 실결제 금액 — 응답(클라이언트 픽셀 value)과 서버 이벤트가 같은 값을 써야
  // 메타 dedup 후에도 매출이 온전히 남는다. 스텝 할인 때문에 meeting.fee로는 안 된다.
  let paidAmount: number | null = null
  if (isPaid && result.registrationId) {
    const { data: reg } = await createServiceClient()
      .from('registrations')
      .select('paid_amount')
      .eq('id', result.registrationId)
      .single()
    paidAmount = reg?.paid_amount ?? null
  }

  // 메타 Conversions API — 브라우저 픽셀이 iOS/광고차단으로 유실될 때의 안전망.
  // event_id를 paymentId로 고정해 클라이언트 픽셀과 dedup된다 (둘 다 와도 1건).
  // after(): 응답 후에도 실행 보장 — void fire-and-forget은 람다 freeze로 유실
  if (isPaid && isMetaCapiEnabled()) {
    after(async () => {
      await sendMetaEvent({
        eventName: 'Purchase',
        eventId: paymentId,
        eventSourceUrl: referer,
        userData: {
          userId: user.id,
          clientIp,
          clientUserAgent,
          fbp,
          fbc,
        },
        customData: {
          currency: 'KRW',
          ...(paidAmount !== null ? { value: paidAmount } : {}),
          content_ids: [meetingId],
          content_type: 'product',
        },
      })
    })
  }

  const httpStatus = result.status === 'error' ? 500 : 200
  return NextResponse.json(
    isPaid ? { ...result, paidAmount } : result,
    { status: httpStatus },
  )
}
