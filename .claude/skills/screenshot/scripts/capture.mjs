#!/usr/bin/env node

/**
 * 범용 웹사이트 스크린샷 캡처 스크립트
 *
 * 사용법:
 *   node capture.mjs <baseUrl> [options]
 *
 * 옵션:
 *   --output, -o     출력 디렉토리 (기본: ./screenshots)
 *   --max-pages      최대 페이지 수 (기본: 50)
 *   --viewport       뷰포트 크기 (기본: 390x844)
 *   --desktop         데스크탑 뷰포트 (1280x800)
 *   --auth           로그인 필요 시 headed 모드로 실행
 *   --urls           URL 목록 파일 경로 (크롤링 대신 목록 사용)
 *   --keep           보관할 캡처 수 (기본: 5)
 *   --delay          페이지 간 딜레이 ms (기본: 500)
 *
 * 예시:
 *   node capture.mjs https://example.com
 *   node capture.mjs https://example.com --auth --output ./ui-review
 *   node capture.mjs https://example.com --urls urls.txt --desktop
 */

import { chromium } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'

// ── CLI 파싱 ──
const args = process.argv.slice(2)

function getArg(name, defaultVal) {
  const idx = args.indexOf(name)
  if (idx === -1) {
    // short alias
    const short = { '--output': '-o' }[name]
    if (short) {
      const si = args.indexOf(short)
      if (si !== -1 && si + 1 < args.length) return args[si + 1]
    }
    return defaultVal
  }
  if (idx + 1 < args.length) return args[idx + 1]
  return defaultVal
}

function hasFlag(name) {
  return args.includes(name)
}

const baseUrl = args.find(a => !a.startsWith('-'))
if (!baseUrl) {
  console.error('Usage: node capture.mjs <baseUrl> [options]')
  console.error('  예: node capture.mjs https://example.com --auth')
  process.exit(1)
}

const OUTPUT_BASE = path.resolve(getArg('--output', './screenshots'))
const MAX_PAGES = parseInt(getArg('--max-pages', '50'), 10)
const KEEP = parseInt(getArg('--keep', '5'), 10)
const DELAY = parseInt(getArg('--delay', '500'), 10)
const IS_DESKTOP = hasFlag('--desktop')
const NEED_AUTH = hasFlag('--auth')
const URLS_FILE = getArg('--urls', null)

const VIEWPORT = IS_DESKTOP
  ? { width: 1280, height: 800 }
  : { width: 390, height: 844 }
const DPR = 2

const TODAY = new Date().toISOString().split('T')[0]
const OUTPUT_DIR = path.join(OUTPUT_BASE, TODAY)
const LATEST_DIR = path.join(OUTPUT_BASE, 'latest')

// ── 유틸 ──
function slugify(urlPath) {
  if (urlPath === '/' || urlPath === '') return 'homepage'
  return urlPath
    .replace(/^\//, '')
    .replace(/\//g, '-')
    .replace(/[^a-zA-Z0-9가-힣\-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/-$/, '')
    .slice(0, 80)
}

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

function waitForEnter(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question(prompt, () => { rl.close(); resolve() })
  })
}

// ── 동적 경로 패턴 감지 ──
// UUID, 숫자 ID 등을 [id] 패턴으로 치환하여 중복 페이지를 건너뜀
const ID_PATTERNS = [
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, // UUID
  /(?<=\/)\d{4,}(?=\/|$)/g,  // 숫자 4자리 이상
]

function toRoutePattern(urlPath) {
  let pattern = urlPath
  for (const regex of ID_PATTERNS) {
    pattern = pattern.replace(regex, '[id]')
  }
  return pattern
}

// ── 크롤링 ──
async function crawl(page, startUrl, maxPages) {
  const origin = new URL(startUrl).origin
  const visited = new Set()
  const visitedPatterns = new Set() // 동적 경로 중복 방지
  const queue = [startUrl]
  const found = []
  const skipExtensions = ['.pdf', '.zip', '.csv', '.xlsx', '.doc', '.docx', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.mp4', '.mp3']

  while (queue.length > 0 && found.length < maxPages) {
    const url = queue.shift()

    // normalize: remove hash and query
    let normalized
    try {
      const u = new URL(url)
      if (u.origin !== origin) continue
      u.hash = ''
      u.search = ''
      normalized = u.toString()
    } catch { continue }

    if (visited.has(normalized)) continue
    if (skipExtensions.some(ext => normalized.toLowerCase().endsWith(ext))) continue

    // 동적 경로 중복 체크: /meetings/abc-123 과 /meetings/def-456 은 같은 패턴
    const urlPath = new URL(normalized).pathname
    const routePattern = toRoutePattern(urlPath)
    if (visitedPatterns.has(routePattern)) {
      visited.add(normalized)
      continue
    }

    visited.add(normalized)
    visitedPatterns.add(routePattern)
    found.push(normalized)

    try {
      await page.goto(normalized, { waitUntil: 'networkidle', timeout: 15000 })
      const links = await page.$$eval('a[href]', anchors =>
        anchors.map(a => a.href).filter(Boolean)
      )
      for (const link of links) {
        try {
          const u = new URL(link)
          if (u.origin === origin && !visited.has(u.origin + u.pathname)) {
            queue.push(u.origin + u.pathname)
          }
        } catch { /* skip invalid */ }
      }
    } catch {
      // page load failed, still keep it in found list
    }
  }

  return found
}

// ── URL 목록 읽기 ──
function readUrlsFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
}

// ── 캡처 ──
async function capture(page, url, outputPath) {
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(1500) // hydration
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    await page.screenshot({ path: outputPath, fullPage: true })
    return true
  } catch (err) {
    console.error(`  ❌ 실패: ${url} — ${err.message}`)
    return false
  }
}

// ── README 생성 ──
function generateReadme(results, siteTitle) {
  const lines = [
    `# ${siteTitle} — UI Screenshots`,
    '',
    '## Capture Info',
    `- **URL**: ${baseUrl}`,
    `- **Date**: ${TODAY}`,
    `- **Viewport**: ${VIEWPORT.width}×${VIEWPORT.height} @${DPR}x`,
    `- **Pages captured**: ${results.length}`,
    '',
    '## Page List',
    '',
    '| # | Path | Screenshot |',
    '|---|------|-----------|',
  ]

  results.forEach((r, i) => {
    lines.push(`| ${i + 1} | \`${r.path}\` | \`${r.file}\` |`)
  })

  lines.push(
    '',
    '## Review Guide',
    '',
    'Please review these screenshots and provide feedback on:',
    '1. **Visual hierarchy** — Is the most important content prominent?',
    '2. **Consistency** — Are colors, spacing, typography consistent across pages?',
    '3. **Mobile UX** — Are touch targets large enough? Is content readable?',
    '4. **Navigation** — Is it clear how to move between pages?',
    '5. **Empty/error states** — Are edge cases handled gracefully?',
    '6. **Accessibility** — Color contrast, text size, interactive element clarity',
    '7. **Overall impression** — Does the design feel cohesive and professional?',
    '',
    '---',
    `*Captured: ${new Date().toISOString()}*`,
    '',
  )

  return lines.join('\n')
}

// ── 히스토리 관리 ──
function cleanOldCaptures() {
  if (!fs.existsSync(OUTPUT_BASE)) return 0
  const dirs = fs.readdirSync(OUTPUT_BASE)
    .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort()
    .reverse()

  let cleaned = 0
  for (let i = KEEP; i < dirs.length; i++) {
    fs.rmSync(path.join(OUTPUT_BASE, dirs[i]), { recursive: true, force: true })
    cleaned++
  }
  return cleaned
}

function updateLatest() {
  if (fs.existsSync(LATEST_DIR)) {
    fs.rmSync(LATEST_DIR, { recursive: true, force: true })
  }
  copyDirRecursive(OUTPUT_DIR, LATEST_DIR)
}

// ── 메인 ──
async function main() {
  console.log('\n📸 웹사이트 스크린샷 캡처')
  console.log(`  URL: ${baseUrl}`)
  console.log(`  뷰포트: ${VIEWPORT.width}×${VIEWPORT.height} @${DPR}x`)
  console.log(`  출력: ${OUTPUT_DIR}`)
  console.log(`  인증: ${NEED_AUTH ? '수동 로그인' : '불필요'}`)
  console.log('')

  // 브라우저 시작
  const browser = await chromium.launch({ headless: !NEED_AUTH })
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: DPR,
  })
  const page = await context.newPage()

  // 인증 처리
  if (NEED_AUTH) {
    console.log('🔐 브라우저가 열렸습니다. 로그인해주세요.')
    await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 30000 })
    await waitForEnter('  로그인 완료 후 Enter를 눌러주세요... ')
    console.log('  로그인 확인. 캡처를 시작합니다.\n')
  }

  // URL 수집
  let urls
  if (URLS_FILE) {
    console.log(`📄 URL 목록 파일: ${URLS_FILE}`)
    urls = readUrlsFile(URLS_FILE)
  } else {
    console.log(`🔍 사이트 크롤링 중... (최대 ${MAX_PAGES}페이지)`)
    urls = await crawl(page, baseUrl, MAX_PAGES)
  }
  console.log(`  ${urls.length}개 페이지 발견\n`)

  if (urls.length === 0) {
    console.log('⚠️  캡처할 페이지가 없습니다.')
    await browser.close()
    return
  }

  // 캡처
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  const results = []
  let success = 0

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]
    const urlPath = new URL(url).pathname
    const idx = String(i + 1).padStart(2, '0')
    const filename = `${idx}-${slugify(urlPath)}.png`
    const outputPath = path.join(OUTPUT_DIR, filename)

    console.log(`  [${i + 1}/${urls.length}] ${urlPath}`)
    const ok = await capture(page, url, outputPath)
    if (ok) {
      success++
      results.push({ path: urlPath, file: filename })
    }

    if (i < urls.length - 1) {
      await page.waitForTimeout(DELAY)
    }
  }

  // README 생성
  let siteTitle = baseUrl
  try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 10000 })
    siteTitle = await page.title() || baseUrl
  } catch { /* use baseUrl */ }

  const readme = generateReadme(results, siteTitle)
  fs.writeFileSync(path.join(OUTPUT_DIR, 'README.md'), readme, 'utf-8')

  // 히스토리 관리
  updateLatest()
  const cleaned = cleanOldCaptures()

  // 정리
  await context.close()
  await browser.close()

  // 결과
  console.log('\n' + '═'.repeat(50))
  console.log(`  📸 캡처 완료: ${success}/${urls.length}장`)
  console.log(`  📁 저장: ${OUTPUT_DIR}`)
  console.log(`  📁 latest: ${LATEST_DIR}`)
  if (cleaned > 0) console.log(`  🗑️  이전 캡처 ${cleaned}개 삭제`)
  console.log('═'.repeat(50) + '\n')
}

main().catch(err => {
  console.error('\n❌ 실패:', err.message)
  process.exit(1)
})
