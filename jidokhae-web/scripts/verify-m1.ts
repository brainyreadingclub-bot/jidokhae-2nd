/**
 * M1 검증 스크립트
 * 실행: npx tsx scripts/verify-m1.ts
 *
 * WP1-1: Supabase Client 3종 초기화
 * WP1-2: DB 스키마, RLS, Functions, Triggers
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Admin client (bypasses RLS)
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Anon client (uses RLS)
const anon = createClient(SUPABASE_URL, ANON_KEY)

let passed = 0
let failed = 0

function ok(name: string) {
  console.log(`  ✅ ${name}`)
  passed++
}
function fail(name: string, reason: string) {
  console.log(`  ❌ ${name}: ${reason}`)
  failed++
}

async function main() {
  console.log('\n=== WP1-1: Supabase Client 초기화 ===\n')

  // 1-1-04: Server(anon) client
  try {
    const { error } = await anon.from('meetings').select('id').limit(1)
    if (error) throw error
    ok('1-1-04: Anon client 초기화 + meetings SELECT 성공')
  } catch (e: unknown) {
    fail('1-1-04: Anon client 초기화', e instanceof Error ? e.message : String(e))
  }

  // 1-1-05: Admin(service_role) client
  try {
    const { error } = await admin.from('profiles').select('id').limit(1)
    if (error) throw error
    ok('1-1-05: Admin client 초기화 + profiles SELECT 성공')
  } catch (e: unknown) {
    fail('1-1-05: Admin client 초기화', e instanceof Error ? e.message : String(e))
  }

  console.log('\n=== WP1-2: DB 스키마 검증 ===\n')

  // 1-2-01: profiles 테이블 구조
  try {
    const { error } = await admin.from('profiles').select('id, kakao_id, nickname, email, role, created_at').limit(0)
    if (error) throw error
    ok('1-2-01: profiles 테이블 컬럼 존재')
  } catch (e: unknown) {
    fail('1-2-01: profiles 테이블', e instanceof Error ? e.message : String(e))
  }

  // 1-2-02: meetings 테이블 구조
  try {
    const { error } = await admin.from('meetings').select('id, title, date, time, location, capacity, fee, status, created_at, updated_at').limit(0)
    if (error) throw error
    ok('1-2-02: meetings 테이블 컬럼 존재')
  } catch (e: unknown) {
    fail('1-2-02: meetings 테이블', e instanceof Error ? e.message : String(e))
  }

  // 1-2-03: registrations 테이블 구조
  try {
    const { error } = await admin.from('registrations').select('id, user_id, meeting_id, status, cancel_type, payment_id, paid_amount, refunded_amount, attended, created_at, cancelled_at').limit(0)
    if (error) throw error
    ok('1-2-03: registrations 테이블 컬럼 존재')
  } catch (e: unknown) {
    fail('1-2-03: registrations 테이블', e instanceof Error ? e.message : String(e))
  }

  // 1-2-07: RLS — anon(미인증)이 registrations 직접 INSERT 차단
  try {
    const { error } = await anon.from('registrations').insert({
      user_id: '00000000-0000-0000-0000-000000000000',
      meeting_id: '00000000-0000-0000-0000-000000000000',
      status: 'confirmed',
    })
    if (error) {
      ok('1-2-07: RLS — registrations 직접 INSERT 차단됨')
    } else {
      fail('1-2-07: RLS', 'INSERT가 차단되지 않음!')
      // cleanup
      await admin.from('registrations').delete().eq('user_id', '00000000-0000-0000-0000-000000000000')
    }
  } catch {
    ok('1-2-07: RLS — registrations 직접 INSERT 차단됨')
  }

  // 1-2-12 ~ 1-2-15: confirm_registration 함수 테스트
  console.log('\n=== WP1-2: DB Functions 검증 ===\n')

  // Create test user via admin auth
  const testEmail = `test-m1-${Date.now()}@test.local`
  let testUserId: string | null = null
  let testMeetingId: string | null = null

  try {
    // Create test user
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: testEmail,
      password: 'test-password-12345',
      email_confirm: true,
    })
    if (authError) throw authError
    testUserId = authData.user.id

    // Wait for trigger
    await new Promise(r => setTimeout(r, 1000))

    // 1-2-10: Trigger — profiles auto-created
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('*')
      .eq('id', testUserId)
      .single()

    if (profileError || !profile) {
      fail('1-2-10: Trigger — profiles 자동 생성', profileError?.message || 'profile not found')
    } else {
      ok('1-2-10: Trigger — auth.users INSERT → profiles 자동 생성')
    }

    // Create test meeting
    const { data: meeting, error: meetingError } = await admin
      .from('meetings')
      .insert({
        title: 'M1 테스트 모임',
        date: '2099-12-31',
        time: '19:00',
        location: '테스트 장소',
        capacity: 2,
        fee: 10000,
      })
      .select()
      .single()

    if (meetingError) throw meetingError
    testMeetingId = meeting.id

    // 1-2-12: confirm_registration 정상 동작
    const { data: result1, error: err1 } = await admin.rpc('confirm_registration', {
      p_user_id: testUserId,
      p_meeting_id: testMeetingId,
      p_payment_id: 'test_pay_001',
      p_paid_amount: 10000,
    })
    if (err1) throw err1
    if (result1 === 'success') {
      ok('1-2-12: confirm_registration 정상 INSERT (success)')
    } else {
      fail('1-2-12: confirm_registration', `expected "success", got "${result1}"`)
    }

    // 1-2-15: 동일 사용자 중복 등록 방어
    const { data: result2, error: err2 } = await admin.rpc('confirm_registration', {
      p_user_id: testUserId,
      p_meeting_id: testMeetingId,
      p_payment_id: 'test_pay_002',
      p_paid_amount: 10000,
    })
    if (err2) throw err2
    if (result2 === 'already_registered') {
      ok('1-2-15: confirm_registration 중복 등록 방어 (already_registered)')
    } else {
      fail('1-2-15: 중복 등록 방어', `expected "already_registered", got "${result2}"`)
    }

    // Create second user for capacity test
    const testEmail2 = `test-m1-2-${Date.now()}@test.local`
    const { data: authData2, error: authError2 } = await admin.auth.admin.createUser({
      email: testEmail2,
      password: 'test-password-12345',
      email_confirm: true,
    })
    if (authError2) throw authError2
    const testUserId2 = authData2.user.id
    await new Promise(r => setTimeout(r, 500))

    // Fill up capacity (capacity=2, already 1 confirmed)
    const { data: result3 } = await admin.rpc('confirm_registration', {
      p_user_id: testUserId2,
      p_meeting_id: testMeetingId,
      p_payment_id: 'test_pay_003',
      p_paid_amount: 10000,
    })
    if (result3 === 'success') {
      ok('1-2-12b: 두 번째 사용자 등록 성공 (정원 2/2)')
    }

    // Create third user — should be full
    const testEmail3 = `test-m1-3-${Date.now()}@test.local`
    const { data: authData3, error: authError3 } = await admin.auth.admin.createUser({
      email: testEmail3,
      password: 'test-password-12345',
      email_confirm: true,
    })
    if (authError3) throw authError3
    const testUserId3 = authData3.user.id
    await new Promise(r => setTimeout(r, 500))

    // 1-2-13: 정원 초과 시 'full' 반환
    const { data: result4, error: err4 } = await admin.rpc('confirm_registration', {
      p_user_id: testUserId3,
      p_meeting_id: testMeetingId,
      p_payment_id: 'test_pay_004',
      p_paid_amount: 10000,
    })
    if (err4) throw err4
    if (result4 === 'full') {
      ok('1-2-13: confirm_registration 정원 초과 (full)')
    } else {
      fail('1-2-13: 정원 초과', `expected "full", got "${result4}"`)
    }

    // 1-2-14: get_confirmed_counts 함수
    const { data: counts, error: countErr } = await admin.rpc('get_confirmed_counts', {
      meeting_ids: [testMeetingId],
    })
    if (countErr) throw countErr
    const meetingCount = counts?.find((c: { meeting_id: string; confirmed_count: number }) => c.meeting_id === testMeetingId)
    if (meetingCount && meetingCount.confirmed_count === 2) {
      ok('1-2-14: get_confirmed_counts 정확한 카운트 반환 (2)')
    } else {
      fail('1-2-14: get_confirmed_counts', `expected 2, got ${JSON.stringify(counts)}`)
    }

    // 1-2-04: user_id + meeting_id UNIQUE 제약 없음 (re-registration 가능)
    // Cancel the first registration, then re-register
    await admin.from('registrations')
      .update({ status: 'cancelled', cancel_type: 'user_cancelled' })
      .eq('user_id', testUserId)
      .eq('meeting_id', testMeetingId)
      .eq('status', 'confirmed')

    const { data: result5, error: err5 } = await admin.rpc('confirm_registration', {
      p_user_id: testUserId,
      p_meeting_id: testMeetingId,
      p_payment_id: 'test_pay_005',
      p_paid_amount: 10000,
    })
    if (err5) throw err5
    if (result5 === 'success') {
      // Check that there are now 2 records for same user+meeting
      const { data: regs } = await admin.from('registrations')
        .select('id')
        .eq('user_id', testUserId)
        .eq('meeting_id', testMeetingId)
      if (regs && regs.length >= 2) {
        ok('1-2-04: user_id+meeting_id UNIQUE 없음 (재신청 복수 레코드)')
      } else {
        fail('1-2-04: UNIQUE 제약', `expected >= 2 records, got ${regs?.length}`)
      }
    } else {
      fail('1-2-04: 재신청', `expected "success", got "${result5}"`)
    }

    // Cleanup: delete test data
    await admin.from('registrations').delete().eq('meeting_id', testMeetingId)
    await admin.from('meetings').delete().eq('id', testMeetingId)
    await admin.auth.admin.deleteUser(testUserId)
    await admin.auth.admin.deleteUser(testUserId2)
    await admin.auth.admin.deleteUser(testUserId3)
    // profiles will cascade delete

    ok('Cleanup: 테스트 데이터 정리 완료')

  } catch (e: unknown) {
    fail('DB Function 테스트', e instanceof Error ? e.message : String(e))
    // Attempt cleanup
    if (testMeetingId) await admin.from('registrations').delete().eq('meeting_id', testMeetingId)
    if (testMeetingId) await admin.from('meetings').delete().eq('id', testMeetingId)
    if (testUserId) await admin.auth.admin.deleteUser(testUserId)
  }

  // Summary
  console.log(`\n=== 검증 결과: ${passed} 통과, ${failed} 실패 ===\n`)
  process.exit(failed > 0 ? 1 : 0)
}

main()
