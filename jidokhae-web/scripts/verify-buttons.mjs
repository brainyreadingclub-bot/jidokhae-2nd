// 버튼 즉시 반응 시험 — 공감 · 답변 남기기 · 완독 · 물어보기 띠 닫기 · 내 정보 저장
// `npm run test:buttons`. next dev를 직접 띄워 /policy/button-lab(가짜 데이터)을 열고,
// 모든 POST를 가짜 응답으로 막은 채 성공·실패 두 갈래를 확인한다. 실패가 하나라도 있으면 exit 1
//
// 실제 서버·DB에는 닿지 않는다: Supabase 주소를 닿지 않는 곳으로 바꿔 띄우고,
// 브라우저에서는 localhost 밖 요청과 가짜로 막지 않은 /api 요청을 전부 끊는다
// 선택: `npm run test:buttons -- <폴더>`면 대기 중 화면 캡처를 그 폴더에 남긴다
import { spawn, execSync } from 'node:child_process'
import net from 'node:net'
import { chromium } from 'playwright'

const SHOT = process.argv[2]
const DELAY = 1500
const READY_TIMEOUT_MS = 180_000
const results = []
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function isPortFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer()
    srv.once('error', () => resolve(false))
    srv.once('listening', () => srv.close(() => resolve(true)))
    srv.listen(port)
  })
}

async function findPort(start) {
  for (let p = start; p < start + 50; p++) if (await isPortFree(p)) return p
  throw new Error('빈 포트를 찾지 못했다')
}

function startServer(port) {
  const child = spawn(`npx next dev -p ${port}`, {
    shell: true,
    env: {
      ...process.env,
      BUTTON_LAB: 'on',
      // .env.local보다 먼저 잡힌다 — 푸터의 설정 조회가 실제 DB로 가지 않게
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:9',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'button-lab',
      SUPABASE_SERVICE_ROLE_KEY: 'button-lab',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let log = ''
  child.stdout.on('data', (d) => { log += d })
  child.stderr.on('data', (d) => { log += d })
  return { child, getLog: () => log }
}

function stopServer(child) {
  if (child.exitCode !== null) return
  try {
    if (process.platform === 'win32') execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' })
    else child.kill('SIGTERM')
  } catch {
    // 이미 끝났다
  }
}

async function waitReady(url) {
  const until = Date.now() + READY_TIMEOUT_MS
  while (Date.now() < until) {
    try {
      const res = await fetch(url)
      if (res.status === 200) return
    } catch {
      // 아직 안 떴다
    }
    await sleep(1000)
  }
  throw new Error(`서버가 ${READY_TIMEOUT_MS / 1000}초 안에 뜨지 않았다`)
}

async function run(url, mode) {
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 390, height: 900 } })
  const page = await context.newPage()
  const fail = mode === 'fail'
  const origin = new URL(url).origin
  const reply = (body) => async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    await sleep(DELAY)
    await route.fulfill({ status: fail ? 500 : 200, contentType: 'application/json', body: JSON.stringify(fail ? { status: 'error', message: '서버 오류' } : body) })
  }
  // 먼저 건 경로가 나중에 건 경로보다 밀린다 — 이 줄이 맨 뒤 안전망이다
  await page.route('**/*', (route) => {
    const req = new URL(route.request().url())
    if (req.origin !== origin || req.pathname.startsWith('/api/')) return route.abort()
    return route.continue()
  })
  await page.route('**/api/answers/*/reactions', reply({ status: 'success', data: { reacted: true } }))
  await page.route('**/api/topics/*/answers', reply({ status: 'success', data: { id: 'new1' } }))
  await page.route('**/api/library/complete', async (route) => {
    if (!fail && route.request().method() === 'POST') {
      // 저장된 값을 쿠키에 남긴다 — router.refresh()가 가져오는 서버 목록이 그 값을 돌려준다
      const { completed } = route.request().postDataJSON() ?? {}
      await context.addCookies([{ name: 'button_lab_completed', value: completed ? '1' : '0', url: origin }])
    }
    return reply({ status: 'success' })(route)
  })
  await page.route('**/api/library/ask', async (route) => {
    const body = route.request().postDataJSON()
    if (body?.action === 'view') return route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":"success"}' })
    return reply({ status: 'success' })(route)
  })
  await page.route('**/api/profile/update', reply({ status: 'success' }))
  await page.goto(url)
  await page.waitForSelector('#thread')
  const tag = `[${mode}]`

  // 공감
  const like = page.locator('#thread button', { hasText: '♡' })
  await like.click()
  await sleep(150)
  check(`${tag} 공감 누른 직후 숫자·상태 바뀜`, (await like.textContent()).includes('3') && (await like.getAttribute('aria-pressed')) === 'true', await like.textContent())
  await sleep(DELAY + 400)
  if (fail) {
    check(`${tag} 공감 실패 → 되돌림`, (await like.textContent()).includes('2') && (await like.getAttribute('aria-pressed')) === 'false', await like.textContent())
    check(`${tag} 공감 실패 안내 표시`, await page.locator('#thread [role=alert]').isVisible())
  } else {
    check(`${tag} 공감 성공 유지`, (await like.textContent()).includes('3'))
  }

  // 답변 남기기
  await page.fill('#thread textarea', '나의 시험 답변')
  await page.locator('#thread button', { hasText: '남기기' }).click()
  await sleep(150)
  const mine = page.locator('#thread', { hasText: '내가 쓴 답변' })
  check(`${tag} 남기기 직후 내 답변 카드가 보임`, (await mine.count()) > 0 && (await page.locator('#thread').textContent()).includes('나의 시험 답변'))
  check(`${tag} 남기기 직후 「저장하는 중…」`, (await page.locator('#thread').textContent()).includes('저장하는 중…'))
  if (SHOT && !fail) await page.screenshot({ path: `${SHOT}/answer-pending.png`, fullPage: false })
  await sleep(DELAY + 400)
  if (fail) {
    check(`${tag} 답변 실패 → 쓴 글이 입력칸으로 돌아옴`, (await page.inputValue('#thread textarea')) === '나의 시험 답변')
    check(`${tag} 답변 실패 안내`, (await page.locator('#thread').textContent()).includes('서버 오류'))
  } else {
    check(`${tag} 답변 성공 → 「저장하는 중」 사라짐`, !(await page.locator('#thread').textContent()).includes('저장하는 중…'))
  }

  // 완독 토글
  const done = page.locator('#grid button', { hasText: /읽는 중|완독/ })
  await done.click()
  await sleep(150)
  check(`${tag} 완독 누른 직후 문구 바뀜`, (await done.textContent()).includes('완독'), await done.textContent())
  await sleep(DELAY + 400)
  if (fail) {
    check(`${tag} 완독 실패 → 되돌림`, (await done.textContent()).includes('읽는 중'), await done.textContent())
    check(`${tag} 완독 실패 토스트`, (await page.textContent('body')).includes('완독 표시를 바꾸지 못했어요'))
  } else {
    // 새로 받은 서버 목록이 저장된 값을 돌려줄 때까지 기다린다
    await page.waitForLoadState('networkidle')
    check(`${tag} 완독 성공 유지`, (await done.textContent()).includes('완독'), await done.textContent())
  }

  // 띠 닫기
  await page.locator('#ask button[aria-label="닫기"]').click()
  await sleep(150)
  check(`${tag} 띠 닫기 직후 사라짐`, (await page.locator('#ask section').count()) === 0)
  await sleep(DELAY + 400)
  if (fail) {
    check(`${tag} 띠 닫기 실패 → 다시 보임 + 안내`, (await page.locator('#ask section').count()) === 1 && (await page.locator('#ask').textContent()).includes('닫지 못했어요'))
  } else {
    check(`${tag} 띠 닫기 성공 유지`, (await page.locator('#ask section').count()) === 0)
  }

  // 내 정보 저장
  await page.locator('#profile button', { hasText: '수정하기' }).click()
  await page.fill('#profile input[type=email]', 'new@example.com')
  await page.locator('#profile button', { hasText: /^저장$/ }).click()
  await sleep(150)
  const prof = await page.locator('#profile').textContent()
  check(`${tag} 저장 직후 보기 화면에 새 값`, prof.includes('new@example.com') && !(await page.locator('#profile input[type=email]').count()))
  check(`${tag} 저장 직후 「저장 중...」`, prof.includes('저장 중...'))
  if (SHOT && !fail) await page.screenshot({ path: `${SHOT}/profile-pending.png`, fullPage: false })
  await sleep(DELAY + 400)
  if (fail) {
    check(`${tag} 저장 실패 → 편집 화면 + 쓴 값 유지`, (await page.inputValue('#profile input[type=email]')) === 'new@example.com')
    check(`${tag} 저장 실패 안내`, (await page.locator('#profile').textContent()).includes('서버 오류'))
  } else {
    check(`${tag} 저장 성공 → 「저장되었습니다」`, (await page.locator('#profile').textContent()).includes('저장되었습니다'))
  }

  await browser.close()
}

const port = await findPort(3123)
const url = `http://localhost:${port}/policy/button-lab`
const { child, getLog } = startServer(port)
let crashed = null
try {
  await waitReady(url)
  await run(url, 'ok')
  await run(url, 'fail')
} catch (err) {
  crashed = err
} finally {
  stopServer(child)
}

console.log(results.join('\n'))
const failed = results.filter((r) => r.startsWith('FAIL')).length
if (crashed) {
  console.error(`\n시험이 중간에 멈췄다: ${crashed.message}\n--- next dev 출력 끝부분 ---\n${getLog().slice(-3000)}`)
  process.exit(1)
}
console.log(`\n${results.length - failed} PASS / ${failed} FAIL`)
process.exit(failed > 0 ? 1 : 0)
