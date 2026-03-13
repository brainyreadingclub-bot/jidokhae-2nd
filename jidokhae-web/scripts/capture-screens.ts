/**
 * Screenshot Capture Script
 *
 * Captures all user-visible screens of a web application using Playwright.
 * Handles authentication, loading states, animations, and multiple viewports.
 *
 * Usage:
 *   npx tsx scripts/capture-screens.ts [--base-url URL] [--output-dir DIR] [--desktop]
 *
 * Prerequisites:
 *   - Dev server running (npm run dev)
 *   - npx playwright install chromium (first time only)
 */

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

// ============================================================
// Configuration
// ============================================================

const BASE_URL = process.argv.find(a => a.startsWith('--base-url='))?.split('=')[1] || 'http://localhost:3000'
const OUTPUT_DIR = process.argv.find(a => a.startsWith('--output-dir='))?.split('=')[1] || 'screenshots'
const INCLUDE_DESKTOP = process.argv.includes('--desktop')
const AUTH_STATE_DIR = '.playwright'
const MEMBER_AUTH = path.join(AUTH_STATE_DIR, 'member-auth.json')
const ADMIN_AUTH = path.join(AUTH_STATE_DIR, 'admin-auth.json')

interface Viewport {
  width: number
  height: number
  label: string
}

const VIEWPORTS: Viewport[] = [
  { width: 360, height: 800, label: 'mobile' },
  ...(INCLUDE_DESKTOP ? [{ width: 1280, height: 800, label: 'desktop' }] : []),
]

interface CaptureStep {
  name: string
  action?: (page: Page) => Promise<void>
  waitMs?: number
  waitForSelector?: string
}

interface RouteConfig {
  url: string
  name: string
  category: string
  requiresAuth: 'none' | 'member' | 'admin'
  captureLoadingState?: boolean
  waitForSelector?: string
  extraSteps?: CaptureStep[]
  skipNetworkIdle?: boolean
}

// ============================================================
// Route Definitions — Customize for your project
// ============================================================

function getRoutes(meetingId?: string): RouteConfig[] {
  const mid = meetingId || 'MEETING_ID'

  return [
    // 01. Auth
    {
      url: '/auth/login',
      name: 'login',
      category: '01-auth',
      requiresAuth: 'none',
      waitForSelector: 'button',
    },

    // 02. Meeting List (Main)
    {
      url: '/',
      name: 'meeting-list',
      category: '02-meetings-list',
      requiresAuth: 'member',
      captureLoadingState: true,
      waitForSelector: '[class*="flex flex-col"]',
    },

    // 03. Meeting Detail
    {
      url: `/meetings/${mid}`,
      name: 'meeting-detail',
      category: '03-meeting-detail',
      requiresAuth: 'member',
      captureLoadingState: true,
    },

    // 04. Payment Flow
    {
      url: `/meetings/${mid}/confirm?paymentKey=test`,
      name: 'payment-confirm',
      category: '04-payment-flow',
      requiresAuth: 'member',
    },
    {
      url: `/meetings/${mid}/payment-fail?code=PAY_PROCESS_CANCELED`,
      name: 'payment-fail-cancel',
      category: '04-payment-flow',
      requiresAuth: 'member',
      skipNetworkIdle: true,
    },
    {
      url: `/meetings/${mid}/payment-fail?code=GENERIC_ERROR&message=${encodeURIComponent('결제 처리 중 오류가 발생했습니다')}`,
      name: 'payment-fail-error',
      category: '04-payment-flow',
      requiresAuth: 'member',
      skipNetworkIdle: true,
    },

    // 05. My Registrations
    {
      url: '/my',
      name: 'my-registrations',
      category: '05-my-registrations',
      requiresAuth: 'member',
      captureLoadingState: true,
    },

    // 06. Admin
    {
      url: '/admin',
      name: 'admin-list',
      category: '06-admin',
      requiresAuth: 'admin',
      captureLoadingState: true,
    },
    {
      url: '/admin/meetings/new',
      name: 'admin-create',
      category: '06-admin',
      requiresAuth: 'admin',
      waitForSelector: 'form',
    },
    ...(meetingId
      ? [
          {
            url: `/admin/meetings/${mid}/edit`,
            name: 'admin-edit',
            category: '06-admin',
            requiresAuth: 'admin' as const,
            waitForSelector: 'form',
          },
        ]
      : []),
  ]
}

// ============================================================
// Core Logic
// ============================================================

async function ensureBrowserInstalled() {
  const { execSync } = await import('child_process')
  try {
    execSync('npx playwright install chromium --with-deps', { stdio: 'inherit' })
  } catch {
    console.log('Note: Playwright browser install had issues, trying to proceed anyway...')
  }
}

async function setupAuth(browser: Browser, role: 'member' | 'admin'): Promise<string> {
  const authFile = role === 'admin' ? ADMIN_AUTH : MEMBER_AUTH

  if (fs.existsSync(authFile)) {
    console.log(`  Using saved ${role} auth state`)
    return authFile
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log(`  Manual login required for: ${role}`)
  console.log(`  A browser window will open.`)
  console.log(`  Please log in, then the script will continue automatically.`)
  console.log(`${'='.repeat(60)}\n`)

  const context = await browser.newContext({
    viewport: { width: 400, height: 800 },
  })
  const page = await context.newPage()

  await page.goto(`${BASE_URL}/auth/login`)

  // Wait for successful login — user lands on main page
  await page.waitForURL(url => !url.toString().includes('/auth/'), {
    timeout: 120_000, // 2 minutes for manual login
  })

  // Wait a bit for session to fully establish
  await page.waitForTimeout(2000)

  fs.mkdirSync(AUTH_STATE_DIR, { recursive: true })
  await context.storageState({ path: authFile })
  await context.close()

  console.log(`  ${role} auth state saved to ${authFile}`)
  return authFile
}

async function captureRoute(
  context: BrowserContext,
  route: RouteConfig,
  viewport: Viewport,
) {
  const page = await context.newPage()
  const categoryDir = path.join(OUTPUT_DIR, route.category, viewport.label)
  fs.mkdirSync(categoryDir, { recursive: true })

  const prefix = path.join(categoryDir, route.name)

  try {
    // 1. Loading state capture (take screenshot as soon as HTML arrives)
    if (route.captureLoadingState) {
      await page.goto(`${BASE_URL}${route.url}`, { waitUntil: 'commit' })
      await page.waitForTimeout(100) // brief pause for loading UI to render
      await page.screenshot({
        path: `${prefix}-loading.png`,
        fullPage: true,
      })
      console.log(`    Captured: ${route.name}-loading`)
    }

    // 2. Loaded state capture
    if (!route.captureLoadingState) {
      // Navigate fresh if we didn't already
      await page.goto(`${BASE_URL}${route.url}`, {
        waitUntil: route.skipNetworkIdle ? 'domcontentloaded' : 'networkidle',
        timeout: 15_000,
      })
    } else {
      // Wait for full load
      try {
        await page.waitForLoadState('networkidle', { timeout: 10_000 })
      } catch {
        // networkidle timeout is OK — page might have streaming/polling
      }
    }

    if (route.waitForSelector) {
      try {
        await page.waitForSelector(route.waitForSelector, { timeout: 5_000 })
      } catch {
        // Selector not found — capture anyway
      }
    }

    // Small delay for CSS transitions / animations to settle
    await page.waitForTimeout(500)

    await page.screenshot({
      path: `${prefix}-loaded.png`,
      fullPage: true,
    })
    console.log(`    Captured: ${route.name}-loaded`)

    // 3. Extra interaction steps (buttons, toasts, animations)
    if (route.extraSteps) {
      for (const step of route.extraSteps) {
        if (step.action) {
          await step.action(page)
        }
        if (step.waitForSelector) {
          try {
            await page.waitForSelector(step.waitForSelector, { timeout: 5_000 })
          } catch {
            // Continue anyway
          }
        }
        await page.waitForTimeout(step.waitMs || 300)
        await page.screenshot({
          path: `${prefix}-${step.name}.png`,
          fullPage: true,
        })
        console.log(`    Captured: ${route.name}-${step.name}`)
      }
    }
  } catch (err) {
    console.error(`    Error capturing ${route.name}: ${err}`)
    // Try to capture error state
    try {
      await page.screenshot({
        path: `${prefix}-error.png`,
        fullPage: true,
      })
      console.log(`    Captured: ${route.name}-error (fallback)`)
    } catch {
      // Nothing we can do
    }
  } finally {
    await page.close()
  }
}

async function findMeetingId(context: BrowserContext): Promise<string | undefined> {
  const page = await context.newPage()
  try {
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle', timeout: 15_000 })
    // Look for a meeting card link
    const link = await page.$('a[href*="/meetings/"]')
    if (link) {
      const href = await link.getAttribute('href')
      if (href) {
        const match = href.match(/\/meetings\/([^/]+)/)
        if (match) {
          console.log(`  Found meeting ID: ${match[1]}`)
          return match[1]
        }
      }
    }
    console.log('  No meetings found on main page — some routes will be skipped')
    return undefined
  } finally {
    await page.close()
  }
}

async function captureErrorAndEmptyStates(
  context: BrowserContext,
  viewport: Viewport,
) {
  const page = await context.newPage()
  const dir = path.join(OUTPUT_DIR, '07-error-loading', viewport.label)
  fs.mkdirSync(dir, { recursive: true })

  // 404 / Not Found
  try {
    await page.goto(`${BASE_URL}/meetings/nonexistent-id-12345`, {
      waitUntil: 'networkidle',
      timeout: 10_000,
    })
    await page.waitForTimeout(500)
    await page.screenshot({
      path: path.join(dir, 'meeting-not-found.png'),
      fullPage: true,
    })
    console.log('    Captured: meeting-not-found')
  } catch {
    console.log('    Could not capture not-found state')
  }

  // Invalid route
  try {
    await page.goto(`${BASE_URL}/this-page-does-not-exist`, {
      waitUntil: 'networkidle',
      timeout: 10_000,
    })
    await page.waitForTimeout(500)
    await page.screenshot({
      path: path.join(dir, '404-page.png'),
      fullPage: true,
    })
    console.log('    Captured: 404-page')
  } catch {
    console.log('    Could not capture 404 state')
  }

  await page.close()
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log('Screenshot Capture')
  console.log('==================')
  console.log(`Base URL: ${BASE_URL}`)
  console.log(`Output: ${OUTPUT_DIR}/`)
  console.log(`Viewports: ${VIEWPORTS.map(v => `${v.label} (${v.width}x${v.height})`).join(', ')}`)
  console.log()

  // Clean output directory
  if (fs.existsSync(OUTPUT_DIR)) {
    fs.rmSync(OUTPUT_DIR, { recursive: true })
  }

  const browser = await chromium.launch({ headless: false })

  try {
    // Setup auth
    console.log('Setting up authentication...')
    const memberAuth = await setupAuth(browser, 'member')
    const adminAuth = await setupAuth(browser, 'admin')

    // Find a real meeting ID for dynamic routes
    const memberContext = await browser.newContext({
      storageState: memberAuth,
      viewport: VIEWPORTS[0],
    })
    const meetingId = await findMeetingId(memberContext)
    await memberContext.close()

    const routes = getRoutes(meetingId)

    // Capture each viewport
    for (const viewport of VIEWPORTS) {
      console.log(`\nViewport: ${viewport.label} (${viewport.width}x${viewport.height})`)
      console.log('-'.repeat(40))

      // Group routes by auth requirement
      const noAuthRoutes = routes.filter(r => r.requiresAuth === 'none')
      const memberRoutes = routes.filter(r => r.requiresAuth === 'member')
      const adminRoutes = routes.filter(r => r.requiresAuth === 'admin')

      // No-auth routes
      if (noAuthRoutes.length > 0) {
        console.log('\n  [No Auth]')
        const ctx = await browser.newContext({ viewport })
        for (const route of noAuthRoutes) {
          await captureRoute(ctx, route, viewport)
        }
        await ctx.close()
      }

      // Member routes
      if (memberRoutes.length > 0) {
        console.log('\n  [Member]')
        const ctx = await browser.newContext({
          storageState: memberAuth,
          viewport,
        })
        for (const route of memberRoutes) {
          await captureRoute(ctx, route, viewport)
        }
        // Error states with member auth
        await captureErrorAndEmptyStates(ctx, viewport)
        await ctx.close()
      }

      // Admin routes
      if (adminRoutes.length > 0) {
        console.log('\n  [Admin]')
        const ctx = await browser.newContext({
          storageState: adminAuth,
          viewport,
        })
        for (const route of adminRoutes) {
          await captureRoute(ctx, route, viewport)
        }
        await ctx.close()
      }
    }

    // Summary
    const totalFiles = countFiles(OUTPUT_DIR)
    console.log(`\n${'='.repeat(40)}`)
    console.log(`Done! ${totalFiles} screenshots saved to ${OUTPUT_DIR}/`)
    console.log(`${'='.repeat(40)}`)

  } finally {
    await browser.close()
  }
}

function countFiles(dir: string): number {
  if (!fs.existsSync(dir)) return 0
  let count = 0
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      count += countFiles(path.join(dir, entry.name))
    } else if (entry.name.endsWith('.png')) {
      count++
    }
  }
  return count
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
