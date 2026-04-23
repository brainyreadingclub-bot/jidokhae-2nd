import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll() {},
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

  // admin 권한 확인
  const admin = createServiceClient()
  const { data: callerProfile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!callerProfile || callerProfile.role !== 'admin') {
    return NextResponse.json(
      { status: 'error', message: '권한이 없습니다' },
      { status: 403 },
    )
  }

  let body: { registrationIds?: string[]; action?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { status: 'error', message: '잘못된 요청입니다' },
      { status: 400 },
    )
  }

  const { registrationIds } = body
  const action = body.action ?? 'confirm'
  if (!registrationIds || !Array.isArray(registrationIds) || registrationIds.length === 0) {
    return NextResponse.json(
      { status: 'error', message: 'registrationIds가 필요합니다' },
      { status: 400 },
    )
  }

  if (registrationIds.length > 50) {
    return NextResponse.json(
      { status: 'error', message: '한 번에 최대 50건까지 처리할 수 있습니다' },
      { status: 400 },
    )
  }

  let confirmed = 0
  let failed = 0
  const failedReasons: { id: string; reason: string }[] = []

  for (const registrationId of registrationIds) {
    if (action === 'unconfirm') {
      const { data } = await admin
        .from('registrations')
        .update({ status: 'pending_transfer' })
        .eq('id', registrationId)
        .eq('status', 'confirmed')
        .eq('payment_method', 'transfer')
        .select('id')

      if (data && data.length > 0) confirmed++
      else {
        failed++
        failedReasons.push({ id: registrationId, reason: 'not_confirmed_transfer' })
      }
    } else {
      // Phase 3 M7 Step 2.5: admin_confirm_transfer DB Function으로 원자화.
      // 기존 COUNT + UPDATE 패턴은 editor 다수 동시 확인 시 정원 초과 위험.
      // DB Function 내부에서 registration + meeting 행에 FOR UPDATE 락을 걸어
      // 정원 재검증과 status 전환을 한 트랜잭션으로 처리.
      //
      // ⚠️ 금지: RPC 성공 후 sendRegistrationConfirmNotification 호출 추가 금지.
      // 운영자가 월말 정산일에 하루 몰아서 입금 확인 처리하기 때문에
      // 동시다발 알림이 회원 혼란을 유발. (CLAUDE.md 규칙 / 검토문서 §2.6)
      const { data: rpcResult, error: rpcError } = await admin.rpc(
        'admin_confirm_transfer',
        { p_registration_id: registrationId },
      )

      if (rpcError) {
        failed++
        failedReasons.push({ id: registrationId, reason: rpcError.message })
        continue
      }

      const result = rpcResult as string

      if (result === 'success') {
        confirmed++
      } else {
        failed++
        failedReasons.push({ id: registrationId, reason: result })
      }
    }
  }

  return NextResponse.json({
    status: failed === 0 ? 'success' : 'partial',
    data: { confirmed, failed, failedReasons },
  })
}
