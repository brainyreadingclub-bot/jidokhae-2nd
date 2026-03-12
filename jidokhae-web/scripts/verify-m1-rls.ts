/**
 * M1 RLS 정책 검증
 * 실행: npx tsx scripts/verify-m1-rls.ts
 *
 * 실제 유저를 생성하고, 해당 유저의 JWT로 anon client를 만들어 RLS를 테스트한다.
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

let passed = 0
let failed = 0
function ok(name: string) { console.log(`  ✅ ${name}`); passed++ }
function fail(name: string, reason: string) { console.log(`  ❌ ${name}: ${reason}`); failed++ }

async function createAuthenticatedClient(email: string, password: string) {
  const client = createClient(SUPABASE_URL, ANON_KEY)
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`signIn failed: ${error.message}`)
  return client
}

async function main() {
  const password = 'test-rls-password-12345'
  const memberEmail = `member-rls-${Date.now()}@test.local`
  const adminEmail = `admin-rls-${Date.now()}@test.local`
  let memberUserId: string = ''
  let adminUserId: string = ''
  let testMeetingId: string = ''

  try {
    // Setup: Create member user
    const { data: d1, error: e1 } = await admin.auth.admin.createUser({
      email: memberEmail, password, email_confirm: true,
    })
    if (e1) throw e1
    memberUserId = d1.user.id
    await new Promise(r => setTimeout(r, 1000))

    // Setup: Create admin user
    const { data: d2, error: e2 } = await admin.auth.admin.createUser({
      email: adminEmail, password, email_confirm: true,
    })
    if (e2) throw e2
    adminUserId = d2.user.id
    await new Promise(r => setTimeout(r, 1000))

    // Set admin role
    await admin.from('profiles').update({ role: 'admin' }).eq('id', adminUserId)

    // Create test meeting via admin
    const { data: meeting, error: meetingErr } = await admin.from('meetings').insert({
      title: 'RLS 테스트 모임', date: '2099-12-31', time: '19:00',
      location: '테스트', capacity: 14, fee: 10000,
    }).select().single()
    if (meetingErr) throw meetingErr
    testMeetingId = meeting.id

    // Create registration for member via admin (service_role)
    await admin.from('registrations').insert({
      user_id: memberUserId, meeting_id: testMeetingId,
      status: 'confirmed', payment_id: 'rls_test_001', paid_amount: 10000,
    })
    // Create registration for admin user too
    await admin.from('registrations').insert({
      user_id: adminUserId, meeting_id: testMeetingId,
      status: 'confirmed', payment_id: 'rls_test_002', paid_amount: 10000,
    })

    // Authenticate as member
    const memberClient = await createAuthenticatedClient(memberEmail, password)
    // Authenticate as admin
    const adminClient = await createAuthenticatedClient(adminEmail, password)

    console.log('\n=== RLS 정책 검증 ===\n')

    // 1-2-05: member가 meetings SELECT 가능
    {
      const { data, error } = await memberClient.from('meetings').select('*')
      if (error) fail('1-2-05: member meetings SELECT', error.message)
      else if (data && data.length >= 1) ok('1-2-05: member가 meetings SELECT 가능')
      else fail('1-2-05: member meetings SELECT', `expected >= 1, got ${data?.length}`)
    }

    // 1-2-06: member가 registrations에서 자기 것만 SELECT
    {
      const { data, error } = await memberClient.from('registrations').select('*')
      if (error) fail('1-2-06: member registrations SELECT', error.message)
      else {
        const allMine = data?.every((r: { user_id: string }) => r.user_id === memberUserId)
        if (allMine && data!.length === 1) ok('1-2-06: member registrations 자기 것만 SELECT (1건)')
        else fail('1-2-06: member registrations', `got ${data?.length} records, allMine=${allMine}`)
      }
    }

    // 1-2-08: admin이 meetings INSERT/UPDATE/DELETE 가능
    {
      // INSERT
      const { data: newMeeting, error: insertErr } = await adminClient.from('meetings').insert({
        title: 'Admin INSERT 테스트', date: '2099-06-01', time: '18:00',
        location: '관리자 테스트', capacity: 10, fee: 5000,
      }).select().single()

      if (insertErr) {
        fail('1-2-08: admin meetings INSERT', insertErr.message)
      } else {
        // UPDATE
        const { error: updateErr } = await adminClient.from('meetings')
          .update({ title: 'Admin UPDATE 테스트' })
          .eq('id', newMeeting.id)

        if (updateErr) {
          fail('1-2-08: admin meetings UPDATE', updateErr.message)
        } else {
          // DELETE
          const { error: deleteErr } = await adminClient.from('meetings')
            .delete().eq('id', newMeeting.id)

          if (deleteErr) fail('1-2-08: admin meetings DELETE', deleteErr.message)
          else ok('1-2-08: admin meetings INSERT/UPDATE/DELETE 모두 성공')
        }
      }
    }

    // 1-2-09: admin이 전체 registrations SELECT 가능
    {
      const { data, error } = await adminClient.from('registrations').select('*')
      if (error) fail('1-2-09: admin registrations SELECT', error.message)
      else if (data && data.length >= 2) ok('1-2-09: admin 전체 registrations SELECT 가능 (2건 이상)')
      else fail('1-2-09: admin registrations', `expected >= 2, got ${data?.length}`)
    }

    // 1-2-11: Trigger — 카카오 미제공 필드 안전 처리
    // (Already tested via createUser with email — no kakao metadata)
    {
      const { data: profile } = await admin.from('profiles')
        .select('*').eq('id', memberUserId).single()
      if (profile && profile.nickname === '' && profile.kakao_id === null) {
        ok('1-2-11: Trigger — 미제공 필드 안전 처리 (nickname="", kakao_id=null)')
      } else {
        fail('1-2-11: Trigger 안전 처리', JSON.stringify(profile))
      }
    }

  } catch (e: unknown) {
    fail('Setup/Teardown', e instanceof Error ? e.message : String(e))
  } finally {
    // Cleanup
    if (testMeetingId) await admin.from('registrations').delete().eq('meeting_id', testMeetingId)
    if (testMeetingId) await admin.from('meetings').delete().eq('id', testMeetingId)
    if (memberUserId) await admin.auth.admin.deleteUser(memberUserId)
    if (adminUserId) await admin.auth.admin.deleteUser(adminUserId)
    console.log('  🧹 테스트 데이터 정리 완료')
  }

  console.log(`\n=== 검증 결과: ${passed} 통과, ${failed} 실패 ===\n`)
  process.exit(failed > 0 ? 1 : 0)
}

main()
