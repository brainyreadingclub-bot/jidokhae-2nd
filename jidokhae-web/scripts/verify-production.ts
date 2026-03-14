/**
 * M6 프로덕션 검증 스크립트
 * 실행: npm run verify:prod (또는 npx tsx scripts/verify-production.ts)
 *
 * 환경 변수, DB 연결, DB Functions를 확인하여
 * 프로덕션 배포 전 준비 상태를 점검합니다.
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

let passed = 0
let failed = 0
let warned = 0

function ok(name: string) {
  console.log(`  ✅ ${name}`)
  passed++
}
function fail(name: string, reason: string) {
  console.log(`  ❌ ${name}: ${reason}`)
  failed++
}
function warn(name: string, reason: string) {
  console.log(`  ⚠️  ${name}: ${reason}`)
  warned++
}

async function main() {
  // ═══ 1. 환경 변수 체크 ═══
  console.log('\n=== 1. 환경 변수 체크 ===\n')

  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_TOSSPAYMENTS_CLIENT_KEY',
    'TOSSPAYMENTS_SECRET_KEY',
    'TOSSPAYMENTS_WEBHOOK_SECRET',
  ] as const

  const missingVars: string[] = []
  for (const varName of requiredEnvVars) {
    const value = process.env[varName]
    if (!value || value.trim() === '') {
      fail(`ENV ${varName}`, '미설정 또는 빈 값')
      missingVars.push(varName)
    } else {
      ok(`ENV ${varName}`)
    }
  }

  if (missingVars.length > 0) {
    console.log(
      '\n  💡 .env.local 파일에 누락된 환경 변수를 설정하세요.\n'
    )
  }

  // ═══ 2. TossPayments 모드 확인 ═══
  console.log('\n=== 2. TossPayments 모드 확인 ===\n')

  const clientKey = process.env.NEXT_PUBLIC_TOSSPAYMENTS_CLIENT_KEY ?? ''
  const secretKey = process.env.TOSSPAYMENTS_SECRET_KEY ?? ''

  if (clientKey.startsWith('live_')) {
    ok('TossPayments Client Key: 라이브 모드 🟢')
  } else if (clientKey.startsWith('test_')) {
    warn('TossPayments Client Key', '테스트 모드 (프로덕션 출시 전 라이브로 전환 필요)')
  } else if (clientKey) {
    warn('TossPayments Client Key', `알 수 없는 접두사: ${clientKey.substring(0, 10)}...`)
  }

  if (secretKey.startsWith('live_sk_')) {
    ok('TossPayments Secret Key: 라이브 모드 🟢')
  } else if (secretKey.startsWith('test_sk_')) {
    warn('TossPayments Secret Key', '테스트 모드 (프로덕션 출시 전 라이브로 전환 필요)')
  } else if (secretKey) {
    warn('TossPayments Secret Key', `알 수 없는 접두사: ${secretKey.substring(0, 12)}...`)
  }

  // ═══ 3. Supabase DB 연결 체크 ═══
  console.log('\n=== 3. Supabase DB 연결 체크 ===\n')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    fail('DB 연결', 'SUPABASE_URL 또는 SERVICE_ROLE_KEY 미설정')
    printSummary()
    return
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // 테이블 존재 확인
  const tables = ['profiles', 'meetings', 'registrations'] as const
  for (const table of tables) {
    try {
      const { error } = await admin.from(table).select('id').limit(0)
      if (error) throw error
      ok(`테이블 ${table} SELECT 성공`)
    } catch (e: unknown) {
      fail(`테이블 ${table}`, e instanceof Error ? e.message : String(e))
    }
  }

  // ═══ 4. DB Functions 체크 ═══
  console.log('\n=== 4. DB Functions 체크 ===\n')

  // confirm_registration (빈 UUID로 호출 → 'not_found' 반환이면 함수 존재)
  try {
    const { data, error } = await admin.rpc('confirm_registration', {
      p_user_id: '00000000-0000-0000-0000-000000000000',
      p_meeting_id: '00000000-0000-0000-0000-000000000000',
      p_payment_id: 'verify_test',
      p_paid_amount: 0,
    })
    if (error) throw error
    if (data === 'not_found' || data === 'not_active') {
      ok('confirm_registration 함수 존재 + 정상 응답')
    } else {
      ok(`confirm_registration 함수 존재 (응답: ${data})`)
    }
  } catch (e: unknown) {
    fail('confirm_registration 함수', e instanceof Error ? e.message : String(e))
  }

  // get_confirmed_counts (빈 배열로 호출)
  try {
    const { data, error } = await admin.rpc('get_confirmed_counts', {
      meeting_ids: [],
    })
    if (error) throw error
    if (Array.isArray(data)) {
      ok('get_confirmed_counts 함수 존재 + 정상 응답')
    } else {
      ok(`get_confirmed_counts 함수 존재 (응답 타입: ${typeof data})`)
    }
  } catch (e: unknown) {
    fail('get_confirmed_counts 함수', e instanceof Error ? e.message : String(e))
  }

  // ═══ 5. RLS 활성화 확인 ═══
  console.log('\n=== 5. RLS 체크 (직접 INSERT 차단) ===\n')

  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!anonKey) {
    fail('RLS 체크', 'ANON_KEY 미설정')
  } else {
    const anon = createClient(supabaseUrl, anonKey)

    // 미인증 anon이 registrations 직접 INSERT 시도 → 차단되어야 함
    try {
      const { error } = await anon.from('registrations').insert({
        user_id: '00000000-0000-0000-0000-000000000000',
        meeting_id: '00000000-0000-0000-0000-000000000000',
        status: 'confirmed',
      })
      if (error) {
        ok('RLS: registrations 직접 INSERT 차단됨')
      } else {
        fail('RLS', 'registrations INSERT가 차단되지 않았습니다!')
        // cleanup
        await admin
          .from('registrations')
          .delete()
          .eq('user_id', '00000000-0000-0000-0000-000000000000')
      }
    } catch {
      ok('RLS: registrations 직접 INSERT 차단됨')
    }
  }

  // ═══ Summary ═══
  printSummary()
}

function printSummary() {
  console.log('\n' + '═'.repeat(50))
  console.log(
    `  검증 결과: ✅ ${passed} 통과 / ❌ ${failed} 실패 / ⚠️  ${warned} 경고`
  )

  if (failed === 0 && warned === 0) {
    console.log('  🟢 프로덕션 배포 준비 완료!')
  } else if (failed === 0) {
    console.log('  🟡 경고 항목을 확인하세요 (기능에는 문제 없음)')
  } else {
    console.log('  🔴 실패 항목을 해결한 후 다시 실행하세요')
  }
  console.log('═'.repeat(50) + '\n')

  process.exit(failed > 0 ? 1 : 0)
}

main()
