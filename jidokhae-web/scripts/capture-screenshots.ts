/**
 * UI/UX 리뷰용 스크린샷 캡처 스크립트
 * 실행: npm run screenshot
 *
 * Playwright + Supabase Admin API를 사용하여
 * 서비스의 모든 주요 화면을 자동 캡처합니다.
 */

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'

config({ path: '.env.local' })

// ── 상수 ──
const BASE_URL = 'https://www.brainy-club.com'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const COOKIE_NAME = 'sb-ycqqzzvyixvtdorjxkrn-auth-token'
const MAX_CHUNK_SIZE = 3180
const TEMP_PASSWORD = `temp-screenshot-${crypto.randomUUID()}`
const OUTPUT_DIR = path.join(process.cwd(), '..', '검토문서', 'ui-review')

// ── Base64URL 인코딩 (@supabase/ssr 호환) ──
function stringToBase64URL(str: string): string {
  return Buffer.from(str, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

// ── 쿠키 청킹 (@supabase/ssr 호환) ──
function createSessionCookies(session: object): Array<{ name: string; value: string }> {
  const json = JSON.stringify(session)
  const encoded = 'base64-' + stringToBase64URL(json)

  const encodedForMeasure = encodeURIComponent(encoded)
  if (encodedForMeasure.length <= MAX_CHUNK_SIZE) {
    return [{ name: COOKIE_NAME, value: encoded }]
  }

  // 청킹: @supabase/ssr의 createChunks 로직 재현
  const chunks: string[] = []
  let remaining = encodeURIComponent(encoded)

  while (remaining.length > 0) {
    let head = remaining.slice(0, MAX_CHUNK_SIZE)
    // % 이스케이프 시퀀스가 잘리지 않도록 처리
    const lastPercent = head.lastIndexOf('%')
    if (lastPercent > MAX_CHUNK_SIZE - 3) {
      head = head.slice(0, lastPercent)
    }
    // 유효한 유니코드 경계에서 자르기
    let decoded = ''
    while (head.length > 0) {
      try {
        decoded = decodeURIComponent(head)
        break
      } catch {
        if (head.at(-3) === '%' && head.length > 3) {
          head = head.slice(0, head.length - 3)
        } else {
          throw new Error('Invalid URI encoding during chunking')
        }
      }
    }
    chunks.push(decoded)
    remaining = remaining.slice(head.length)
  }

  return chunks.map((value, i) => ({ name: `${COOKIE_NAME}.${i}`, value }))
}

// ── Admin 유저 조회 + 세션 획득 ──
async function getAdminSession(admin: SupabaseClient): Promise<{
  session: object
  userId: string
  originalEmail: string | null
}> {
  console.log('\n=== 1. Admin 유저 조회 ===\n')

  // profiles에서 admin 찾기
  const { data: profiles, error: profileErr } = await admin
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .limit(1)

  if (profileErr || !profiles?.length) {
    throw new Error(`Admin 유저를 찾을 수 없습니다: ${profileErr?.message}`)
  }

  const userId = profiles[0].id
  console.log(`  Admin userId: ${userId}`)

  // auth에서 이메일 확인
  const { data: authUser, error: authErr } = await admin.auth.admin.getUserById(userId)
  if (authErr) throw new Error(`getUserById 실패: ${authErr.message}`)

  const originalEmail = authUser.user.email ?? null
  console.log(`  Email: ${originalEmail || '(없음)'}`)

  // 이메일이 없으면 임시 이메일 설정
  const email = originalEmail || 'admin-screenshot@temp.local'
  if (!originalEmail) {
    console.log(`  임시 이메일 설정: ${email}`)
    const { error } = await admin.auth.admin.updateUserById(userId, { email })
    if (error) throw new Error(`이메일 설정 실패: ${error.message}`)
  }

  // 임시 비밀번호 설정
  console.log('  임시 비밀번호 설정...')
  const { error: pwErr } = await admin.auth.admin.updateUserById(userId, {
    password: TEMP_PASSWORD,
  })
  if (pwErr) throw new Error(`비밀번호 설정 실패: ${pwErr.message}`)

  // signInWithPassword로 세션 획득
  console.log('  세션 획득 중...')
  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data, error: signInErr } = await anonClient.auth.signInWithPassword({
    email,
    password: TEMP_PASSWORD,
  })

  if (signInErr || !data.session) {
    throw new Error(`로그인 실패: ${signInErr?.message}`)
  }

  console.log('  세션 획득 성공!')
  return { session: data.session, userId, originalEmail }
}

// ── 동적 ID 조회 ──
async function getMeetingId(admin: SupabaseClient): Promise<string> {
  const { data, error } = await admin
    .from('meetings')
    .select('id')
    .eq('status', 'active')
    .order('date', { ascending: false })
    .limit(1)

  if (error || !data?.length) {
    throw new Error(`활성 모임을 찾을 수 없습니다: ${error?.message}`)
  }
  return data[0].id
}

// ── 스크린샷 캡처 ──
async function capture(page: Page, url: string, outputPath: string): Promise<boolean> {
  try {
    console.log(`  📸 ${url}`)
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(1000) // hydration 대기

    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    await page.screenshot({ path: outputPath, fullPage: true })
    console.log(`     → ${path.relative(process.cwd(), outputPath)}`)
    return true
  } catch (err) {
    console.error(`     ❌ 실패: ${err instanceof Error ? err.message : err}`)
    return false
  }
}

// ── README 생성 ──
function generateReadme(captures: Array<{ flow: string; desc: string; file: string }>) {
  const lines = [
    '# 지독해 서비스 UI/UX 리뷰 자료',
    '',
    '## 서비스 개요',
    '- **서비스명**: 지독해 (JIDOKHAE) - 독서모임 관리 웹앱',
    '- **대상**: 모바일 사용자 (max-width: 640px)',
    '- **사용자 역할**: 회원 (모임 탐색/신청/취소) + 운영자 (모임 생성/수정/관리)',
    '- **기술 스택**: Next.js 16, Supabase (Auth + DB), TossPayments, Tailwind CSS v4',
    '- **프로덕션 URL**: https://www.brainy-club.com',
    '- **캡처 뷰포트**: 390×844 (iPhone 14), 2x DPR',
    '',
    '## 화면 목록',
    '',
  ]

  let currentFlow = ''
  for (const c of captures) {
    if (c.flow !== currentFlow) {
      currentFlow = c.flow
      lines.push(`### ${c.flow}`)
      lines.push('')
    }
    lines.push(`- **${c.desc}**: \`${c.file}\``)
  }

  lines.push(
    '',
    '## AI 리뷰 요청 사항',
    '',
    '아래 관점에서 UI/UX 개선점을 분석해주세요:',
    '',
    '1. **모바일 UX 흐름**: 사용자가 모임을 발견하고 신청하는 과정이 직관적인가?',
    '2. **시각적 계층 구조**: 정보 밀도가 적절한가? 중요 정보가 눈에 잘 띄는가?',
    '3. **접근성**: 터치 타겟 크기, 색상 대비, 텍스트 가독성은 적절한가?',
    '4. **일관성**: 컴포넌트 스타일, 간격, 타이포그래피가 통일되어 있는가?',
    '5. **페이지 전환**: 네비게이션 구조가 명확한가? 사용자가 현재 위치를 알 수 있는가?',
    '6. **빈 상태 / 에러 상태**: 사용자에게 다음 행동을 안내하고 있는가?',
    '7. **운영자 화면**: 모임 관리 흐름이 효율적인가? 불필요한 단계는 없는가?',
    '',
    '---',
    `*캡처 일시: ${new Date().toISOString().split('T')[0]}*`,
    '',
  )

  return lines.join('\n')
}

// ── 메인 ──
async function main() {
  console.log('\n🔧 UI/UX 리뷰용 스크린샷 캡처 시작\n')

  // 환경 변수 검증
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('.env.local에 Supabase 환경 변수가 필요합니다')
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // 1. Admin 세션 획득
  const { session, userId, originalEmail } = await getAdminSession(admin)
  const sessionCookies = createSessionCookies(session)
  console.log(`  쿠키 ${sessionCookies.length}개 생성`)

  // 2. 모임 ID 조회
  const meetingId = await getMeetingId(admin)
  console.log(`  모임 ID: ${meetingId}`)

  // 3. Playwright 브라우저 시작
  console.log('\n=== 2. 브라우저 시작 ===\n')
  const browser = await chromium.launch({ headless: true })

  // 인증된 context (admin)
  const authContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  })
  await authContext.addCookies(
    sessionCookies.map(({ name, value }) => ({
      name,
      value,
      domain: '.brainy-club.com',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax' as const,
    }))
  )
  const authPage = await authContext.newPage()

  // 비인증 context (로그인 페이지용)
  const unauthContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  })
  const unauthPage = await unauthContext.newPage()

  // 4. 스크린샷 캡처
  console.log('\n=== 3. 스크린샷 캡처 ===\n')

  const captures: Array<{ flow: string; desc: string; file: string }> = []
  let successCount = 0

  const pages = [
    // Flow 5: 운영자 관리
    { flow: 'Flow 5: 운영자 — 모임 관리', desc: '운영 대시보드', path: '/admin', dir: 'flow5-admin-manage', file: '5-1-admin-dashboard.png', auth: true },
    { flow: 'Flow 5: 운영자 — 모임 관리', desc: '모임 생성 폼', path: '/admin/meetings/new', dir: 'flow5-admin-manage', file: '5-2-meeting-create-form.png', auth: true },
    { flow: 'Flow 5: 운영자 — 모임 관리', desc: '모임 수정 폼', path: `/admin/meetings/${meetingId}/edit`, dir: 'flow5-admin-manage', file: '5-3-meeting-edit-form.png', auth: true },
    // Flow 6: 운영자 상세
    { flow: 'Flow 6: 운영자 — 모임 상세', desc: '모임 상세 (관리 영역 포함)', path: `/meetings/${meetingId}`, dir: 'flow6-admin-detail', file: '6-1-meeting-detail-admin.png', auth: true },
    // Flow 2: 모임 탐색
    { flow: 'Flow 2: 모임 탐색', desc: '메인 — 모임 목록', path: '/', dir: 'flow2-browse', file: '2-1-meeting-list.png', auth: true },
    // Flow 4: 내 신청
    { flow: 'Flow 4: 내 신청 관리', desc: '내 신청 목록', path: '/my', dir: 'flow4-my-registrations', file: '4-1-my-registrations.png', auth: true },
    // Flow 1: 온보딩 (비인증)
    { flow: 'Flow 1: 온보딩', desc: '로그인 페이지', path: '/auth/login', dir: 'flow1-onboarding', file: '1-1-login.png', auth: false },
  ]

  for (const p of pages) {
    const page = p.auth ? authPage : unauthPage
    const outputPath = path.join(OUTPUT_DIR, p.dir, p.file)
    const ok = await capture(page, `${BASE_URL}${p.path}`, outputPath)
    if (ok) {
      successCount++
      captures.push({ flow: p.flow, desc: p.desc, file: `${p.dir}/${p.file}` })
    }
  }

  // 비인증 모임 상세 (일반 사용자 시점)
  {
    const outputPath = path.join(OUTPUT_DIR, 'flow2-browse', '2-3-meeting-detail.png')
    const ok = await capture(unauthPage, `${BASE_URL}/meetings/${meetingId}`, outputPath)
    if (ok) {
      successCount++
      captures.push({ flow: 'Flow 2: 모임 탐색', desc: '모임 상세 (비회원 시점)', file: 'flow2-browse/2-3-meeting-detail.png' })
    }
  }

  // 5. README 생성
  console.log('\n=== 4. README 생성 ===\n')
  const readme = generateReadme(captures)
  const readmePath = path.join(OUTPUT_DIR, 'README.md')
  fs.writeFileSync(readmePath, readme, 'utf-8')
  console.log(`  → ${path.relative(process.cwd(), readmePath)}`)

  // 6. 정리
  console.log('\n=== 5. 정리 ===\n')
  await authContext.close()
  await unauthContext.close()
  await browser.close()
  console.log('  브라우저 종료')

  // 임시 비밀번호 무효화 (새 랜덤 비밀번호로 덮어쓰기)
  const newRandomPw = crypto.randomUUID() + crypto.randomUUID()
  await admin.auth.admin.updateUserById(userId, { password: newRandomPw })
  console.log('  임시 비밀번호 무효화 완료')

  // 원래 이메일이 없었으면 경고
  if (!originalEmail) {
    console.log('  ⚠️  임시 이메일(admin-screenshot@temp.local)이 남아있습니다.')
    console.log('     카카오 로그인에는 영향 없습니다.')
  }

  // 결과
  console.log('\n' + '═'.repeat(50))
  console.log(`  📸 캡처 완료: ${successCount}/${pages.length + 1}장`)
  console.log(`  📁 저장 위치: ${OUTPUT_DIR}`)
  console.log('═'.repeat(50) + '\n')
}

main().catch((err) => {
  console.error('\n❌ 스크립트 실패:', err)
  process.exit(1)
})
