# PWA Service Worker 도입 (콜드스타트 FCP 개선) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모바일 PWA 콜드스타트에서 표시되는 manifest splash(`#0d2920` + "지" 로고) 시간을 두 번째 방문부터 단축한다. asset(JS/CSS/font)을 SW 캐시에 저장해 네트워크 왕복 없이 첫 paint를 그리는 것이 핵심.

**Architecture:** `@serwist/next`(Workbox 후계 + Next.js App Router 공식 지원)로 SW 생성. **HTML/API/auth는 절대 캐시 안 함**(stale 데이터 위험), Next.js static asset(`/_next/static/*`) + 외부 폰트 CDN만 cache-first. 새 SW는 `skipWaiting + clientsClaim`으로 즉시 점령(250명 규모에서 운영 단순함이 우선). dev 모드는 SW 비활성화.

**Tech Stack:** `@serwist/next` (^9), `serwist` (^9), Next.js 16.1.6, TypeScript

**Branch:** `feat/pwa-service-worker` — 안정성 카테고리(사용자 화면 영향 0). main에서 분기. (project convention 준수: `feat/`, `chore/`, `docs/` 사용)

**Verification:** 코드 단위 테스트 불가능(SW는 브라우저 런타임). Verification gates:
1. `npm run prelaunch` 통과
2. `npm run build` 후 `jidokhae-web/public/sw.js` 생성 확인
3. `npm run start` 후 로컬에서 SW 등록 확인 (Chrome DevTools → Application → Service Workers)
4. Vercel preview 배포 후 모바일 PWA 설치 + 두 번째 콜드스타트 FCP 측정

**Rollback Plan:**
- 코드 revert: `git revert -m 1 <merge-sha>` + push (1~2분 내 복구)
- 사용자 폰의 기존 SW 비활성화: `public/sw.js`를 빈 SW(아래 코드)로 덮어쓰고 배포
  ```js
  self.addEventListener('install', () => self.skipWaiting())
  self.addEventListener('activate', (e) => e.waitUntil(
    self.registration.unregister().then(() => self.clients.matchAll())
      .then((clients) => clients.forEach((c) => c.navigate(c.url)))
  ))
  ```

---

## File Structure

| 파일 | 역할 | 변경 종류 |
|---|---|---|
| `jidokhae-web/package.json` | `@serwist/next`, `serwist` dependency 추가 | Modify |
| `jidokhae-web/next.config.ts` | `withSerwistInit`로 wrap | Modify |
| `jidokhae-web/src/sw.ts` | SW 소스 (캐시 전략 정의) | Create |
| `jidokhae-web/src/components/ServiceWorkerRegister.tsx` | 클라이언트 SW 등록 컴포넌트 | Create |
| `jidokhae-web/src/app/layout.tsx` | Register 컴포넌트 마운트 | Modify |
| `jidokhae-web/.gitignore` | 빌드 산출물 `public/sw.js`, `public/sw.js.map`, `public/swe-worker-*.js` 제외 | Modify |
| `jidokhae-web/CLAUDE.md` | SW 운영 메모 추가 | Modify |
| `CLAUDE.md` (root) | 배포 정책에 SW 카테고리 한 줄 | Modify |

`src/sw.ts` 위치 선택 이유: `src/app/sw.ts`로 두면 App Router 라우트 파일과 헷갈릴 수 있어 `src/` 직속으로 둔다. `swSrc`는 경로 문자열이라 어디든 OK.

---

## Task 0: 사전 호환성 검증 (Next.js 16 ↔ Serwist v9)

**Files:** (변경 없음)

이 단계가 실패하면 이후 모든 task가 wasted work가 된다. 5분 안에 끝낸다.

- [ ] **Step 1: 최신 버전 확인**

```bash
npm view @serwist/next version
npm view serwist version
```

Expected: 두 패키지 모두 `9.x.x` 출력 (또는 그 이상)

- [ ] **Step 2: GitHub에서 Next.js 16 호환성 issue 조회**

`https://github.com/serwist/serwist/issues?q=next.js+16` 검색.

확인 사항:
- "Next.js 16 not supported" 류의 open issue 있는지
- 최근 (2026-Q1 기준) Next 16 관련 fix가 release됐는지

Expected: 막힘 issue 없음 → 진행. 막힘 있으면 → 약점 2의 대안(`@ducanh2912/next-pwa` 또는 manual SW)으로 plan 재작성.

- [ ] **Step 3: 빈 프로젝트에 가상 install 시도 (선택)**

빠르게 호환성 의심되면:
```bash
cd /tmp
mkdir serwist-compat-test && cd serwist-compat-test
npm init -y
npm install next@16.1.6 @serwist/next@latest serwist@latest --dry-run
```

Expected: peer dep 충돌 없음

- [ ] **Step 4: 결과 기록**

호환성 OK이면 다음 task로. 막힘 있으면 plan 재검토 후 사용자 컨펌 받음. (이 경우 여기서 멈춤)

---

## Task 1: Branch 생성 + dependency 설치

**Files:**
- Modify: `jidokhae-web/package.json`
- Modify: `jidokhae-web/package-lock.json`

- [ ] **Step 1: main 최신화 + 브랜치 생성**

```bash
cd C:/jidokhae-2nd
git checkout main
git pull origin main
git checkout -b feat/pwa-service-worker
```

Expected: `Switched to a new branch 'feat/pwa-service-worker'`

- [ ] **Step 2: dependency 설치**

```bash
cd C:/jidokhae-2nd/jidokhae-web
npm install --save @serwist/next@^9 serwist@^9
```

Expected: `package.json`에 두 패키지 추가, `node_modules`에 설치됨

- [ ] **Step 3: 설치 검증**

```bash
cd C:/jidokhae-2nd/jidokhae-web
node -e "console.log(require('@serwist/next/package.json').version)"
node -e "console.log(require('serwist/package.json').version)"
```

Expected: 둘 다 `9.x.x` 출력

- [ ] **Step 4: Commit**

```bash
cd C:/jidokhae-2nd
git add jidokhae-web/package.json jidokhae-web/package-lock.json
git commit -m "chore(pwa): add @serwist/next dependency for service worker"
```

---

## Task 2: .gitignore에 SW 빌드 산출물 추가

**Files:**
- Modify: `jidokhae-web/.gitignore`

- [ ] **Step 1: .gitignore에 SW 산출물 라인 추가**

`jidokhae-web/.gitignore` 파일의 `# next.js` 섹션 아래에 다음 추가:

```
# Serwist generated service worker (runtime build artifact)
/public/sw.js
/public/sw.js.map
/public/swe-worker-*.js
```

- [ ] **Step 2: Commit**

```bash
cd C:/jidokhae-2nd
git add jidokhae-web/.gitignore
git commit -m "chore(pwa): ignore serwist build artifacts in public/"
```

---

## Task 3: SW 소스 파일 작성 (캐시 전략 정의)

**Files:**
- Create: `jidokhae-web/src/sw.ts`

- [ ] **Step 1: src/sw.ts 작성**

`jidokhae-web/src/sw.ts` 신규 작성:

```typescript
import {
  CacheFirst,
  ExpirationPlugin,
  NetworkFirst,
  NetworkOnly,
  Serwist,
  StaleWhileRevalidate,
} from 'serwist'
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // 1. API: NEVER cache (결제, 신청, 알림톡 등 절대 stale 금지)
    {
      matcher: ({ url }) => url.pathname.startsWith('/api/'),
      handler: new NetworkOnly(),
    },
    // 2. Auth flows: NEVER cache (PKCE, 세션 토큰)
    {
      matcher: ({ url }) => url.pathname.startsWith('/auth/'),
      handler: new NetworkOnly(),
    },
    // 3. Next.js RSC payloads: NEVER cache
    {
      matcher: ({ url }) => url.pathname.startsWith('/_next/data/'),
      handler: new NetworkOnly(),
    },
    // 4. HTML navigation (admin 포함): NetworkFirst (fresh 우선, 오프라인 시 캐시 fallback)
    //   admin도 동일 전략 — HTML은 매번 fresh, JS/CSS만 캐시되므로 데이터 stale 위험 없음
    {
      matcher: ({ request }) => request.mode === 'navigate',
      handler: new NetworkFirst({
        cacheName: 'pages',
        networkTimeoutSeconds: 3,
      }),
    },
    // 5. Next.js static asset (revisioned by build hash): CacheFirst
    {
      matcher: ({ url }) => url.pathname.startsWith('/_next/static/'),
      handler: new CacheFirst({
        cacheName: 'next-static',
      }),
    },
    // 6. 외부 폰트 CDN (Pretendard, Google Fonts): CacheFirst
    {
      matcher: ({ url }) =>
        url.hostname === 'cdn.jsdelivr.net' ||
        url.hostname === 'fonts.googleapis.com' ||
        url.hostname === 'fonts.gstatic.com',
      handler: new CacheFirst({
        cacheName: 'fonts',
        plugins: [
          new ExpirationPlugin({
            maxEntries: 16,
            maxAgeSeconds: 60 * 60 * 24 * 365, // 1년
          }),
        ],
      }),
    },
    // 7. PWA 아이콘 (Next.js generated icons): CacheFirst
    {
      matcher: ({ url }) =>
        url.pathname === '/icon' ||
        url.pathname === '/icon-maskable' ||
        url.pathname === '/apple-icon' ||
        url.pathname === '/opengraph-image' ||
        url.pathname === '/twitter-image' ||
        url.pathname === '/favicon.ico',
      handler: new CacheFirst({
        cacheName: 'app-icons',
      }),
    },
    // 8. PWA manifest: StaleWhileRevalidate (수정 시 사용자 폰에 반영되도록)
    {
      matcher: ({ url }) =>
        url.pathname === '/manifest.webmanifest' ||
        url.pathname === '/manifest.json',
      handler: new StaleWhileRevalidate({
        cacheName: 'app-manifest',
      }),
    },
    // 9. 일반 이미지: StaleWhileRevalidate
    {
      matcher: ({ request }) => request.destination === 'image',
      handler: new StaleWhileRevalidate({
        cacheName: 'images',
        plugins: [
          new ExpirationPlugin({
            maxEntries: 64,
            maxAgeSeconds: 60 * 60 * 24 * 30, // 30일
          }),
        ],
      }),
    },
  ],
})

serwist.addEventListeners()
```

- [ ] **Step 2: TypeScript 컴파일 확인 (SW는 빌드 시점에 컴파일됨, 일반 tsc로 직접 확인)**

```bash
cd C:/jidokhae-2nd/jidokhae-web
npx tsc --noEmit
```

Expected: 에러 없음. 만약 `WebWorker` lib 관련 에러 발생 시 → tsconfig.json의 `lib`에 `"WebWorker"` 추가 필요. (대부분의 경우 `serwist`의 ambient types가 처리)

- [ ] **Step 3: Commit**

```bash
cd C:/jidokhae-2nd
git add jidokhae-web/src/sw.ts
git commit -m "feat(pwa): add service worker source with safe cache strategies

- API/auth/admin/_next/data: NetworkOnly (절대 캐시 안 함)
- HTML navigation: NetworkFirst (3s timeout, offline fallback)
- /_next/static, fonts, icons: CacheFirst
- 일반 이미지: StaleWhileRevalidate
- skipWaiting + clientsClaim 으로 새 버전 즉시 점령"
```

---

## Task 4: next.config.ts에 Serwist wrap 적용

**Files:**
- Modify: `jidokhae-web/next.config.ts`

- [ ] **Step 1: next.config.ts 수정**

기존:
```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ]
  },
}

export default nextConfig
```

수정 후:
```typescript
import type { NextConfig } from 'next'
import withSerwistInit from '@serwist/next'

const baseConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ]
  },
}

const withSerwist = withSerwistInit({
  swSrc: 'src/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
})

export default withSerwist(baseConfig)
```

- [ ] **Step 2: prod 빌드로 SW 생성 확인**

```bash
cd C:/jidokhae-2nd/jidokhae-web
npm run build
```

Expected:
- 빌드 성공
- 콘솔에 Serwist 빌드 로그 (`compiled service worker` 등)
- `jidokhae-web/public/sw.js` 파일 생성됨

- [ ] **Step 3: 생성된 SW 파일 검증**

```bash
cd C:/jidokhae-2nd/jidokhae-web
ls -lh public/sw.js
```

Expected: 수십 KB ~ 수백 KB의 압축된 JS 파일

- [ ] **Step 4: Commit**

```bash
cd C:/jidokhae-2nd
git add jidokhae-web/next.config.ts
git commit -m "feat(pwa): wire @serwist/next into next.config (dev mode disabled)"
```

---

## Task 5: SW 등록 컴포넌트 작성

**Files:**
- Create: `jidokhae-web/src/components/ServiceWorkerRegister.tsx`

- [ ] **Step 1: 등록 컴포넌트 작성**

`jidokhae-web/src/components/ServiceWorkerRegister.tsx` 신규 작성:

```typescript
'use client'

import { useEffect } from 'react'

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      process.env.NODE_ENV !== 'production'
    ) {
      return
    }

    const register = async () => {
      try {
        await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      } catch (error) {
        // SW 실패는 사이트 동작을 막지 않음. 콘솔에만 기록.
        console.error('[SW] registration failed', error)
      }
    }

    register()
  }, [])

  return null
}
```

- [ ] **Step 2: Commit**

```bash
cd C:/jidokhae-2nd
git add jidokhae-web/src/components/ServiceWorkerRegister.tsx
git commit -m "feat(pwa): add client-side service worker registration component"
```

---

## Task 6: layout.tsx에 등록 컴포넌트 마운트

**Files:**
- Modify: `jidokhae-web/src/app/layout.tsx`

- [ ] **Step 1: import 추가 + 컴포넌트 마운트**

`jidokhae-web/src/app/layout.tsx` 수정:

기존 import 영역에 추가:
```typescript
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister'
```

기존 `<body>` 내부의 `<Analytics />` 바로 위에 추가:
```tsx
<ServiceWorkerRegister />
<Analytics />
<SpeedInsights />
```

- [ ] **Step 2: prod 빌드 + 로컬 시작**

```bash
cd C:/jidokhae-2nd/jidokhae-web
npm run build
npm run start
```

Expected: `http://localhost:3000` 접속 시 정상 렌더

- [ ] **Step 3: 로컬에서 SW 등록 검증**

브라우저(Chrome) → `http://localhost:3000` 접속 → DevTools 열기 (F12) → **Application 탭** → **Service Workers**

Expected:
- "지독해" SW가 `activated and is running` 상태
- Source: `/sw.js`
- Scope: `http://localhost:3000/`

추가 확인 (DevTools Application → **Cache Storage**):
- `pages`, `next-static`, `fonts`, `app-icons` 캐시가 점진적으로 채워짐 (페이지 탐색 후)

만약 SW가 등록되지 않으면:
- Console 탭에서 에러 확인
- Network 탭에서 `/sw.js` 응답이 200인지 확인
- `npm run build`가 SW 파일을 새로 생성했는지 재확인

- [ ] **Step 4: 캐시 무효화 검증 (재빌드)**

서버 종료 → 코드를 임의로 수정 (예: `src/app/(main)/page.tsx`의 헤더 텍스트 변경) → `npm run build` 다시 실행 → `npm run start` → 페이지 새로고침.

Expected: 새 컨텐츠가 보임 (skipWaiting + clientsClaim으로 즉시 새 SW 점령)

수정한 임시 변경은 되돌리기 (이번 task에서 commit 대상 아님).

- [ ] **Step 5: Commit**

```bash
cd C:/jidokhae-2nd
git add jidokhae-web/src/app/layout.tsx
git commit -m "feat(pwa): mount ServiceWorkerRegister in root layout"
```

---

## Task 7: prelaunch 통과 확인

**Files:** (변경 없음)

- [ ] **Step 1: prelaunch 실행**

```bash
cd C:/jidokhae-2nd/jidokhae-web
npm run prelaunch
```

Expected: lint + tsc + test + build 모두 통과

만약 실패:
- lint 에러 → ESLint 룰 위반 수정
- tsc 에러 → 타입 수정 (특히 `sw.ts`의 ambient types)
- test 실패 → SW 도입과 무관한 회귀가 있는지 확인
- build 실패 → Serwist 설정 재확인

이 단계가 통과해야 다음 단계 진행.

- [ ] **Step 2: (별도 commit 불필요. 검증 단계.)**

---

## Task 8: 문서 업데이트 + 운영 가이드

**Files:**
- Modify: `jidokhae-web/CLAUDE.md`
- Modify: `CLAUDE.md` (root)
- Create: `검토문서/2026-04-28-pwa-sw-운영-가이드.md`

- [ ] **Step 1: jidokhae-web/CLAUDE.md에 PWA 섹션 추가**

`jidokhae-web/CLAUDE.md`의 "Key Conventions" 섹션 끝에 다음 항목 추가:

```markdown
- **PWA Service Worker** (2026-04-28 도입): `@serwist/next`로 SW 생성. `src/sw.ts`가 캐시 전략 단일 소스. **API/auth/admin/_next/data 라우트는 절대 캐시 안 함** (NetworkOnly). HTML은 NetworkFirst, `_next/static`+font+icon은 CacheFirst. dev 모드는 SW 비활성. SW 산출물(`public/sw.js`, `public/swe-worker-*.js`)은 빌드 산출물이라 git ignore. 새 SW 감지 시 `skipWaiting + clientsClaim`으로 즉시 점령(사용자에게 prompt 없음). 화면 이상 신고 시 SW 캐시를 1순위로 의심 → 사용자에게 PWA 강제 종료 후 재실행 또는 새로고침 안내.
```

- [ ] **Step 2: root CLAUDE.md "Branching & Deployment Strategy" 섹션에 묶음 카테고리 1번(안정성/백엔드/DB) 예시에 PWA SW 추가**

`C:/jidokhae-2nd/CLAUDE.md`의 다음 부분:

```
1. **안정성/백엔드/DB** — 사용자 화면 영향 0 (풀스캔, schema, 타입, cron, API 응답 형식 등)
```

→ 다음으로 수정:

```
1. **안정성/백엔드/DB** — 사용자 화면 영향 0 (풀스캔, schema, 타입, cron, API 응답 형식, PWA Service Worker 등)
```

- [ ] **Step 3: 운영 가이드 문서 작성**

`검토문서/2026-04-28-pwa-sw-운영-가이드.md` 신규 작성:

```markdown
# PWA Service Worker 운영 가이드 (2026-04-28)

## 화면 이상 신고 받았을 때 첫 5분 진단

### 1단계 — 사용자에게 물어볼 것
- 어디서 열었나요? (홈 화면 PWA / 브라우저 탭 / 카카오톡 인앱)
- 폰 종류? (iPhone / Android)
- 언제부터 이상했나요?

### 2단계 — SW 캐시 의심 시 사용자에게 안내할 알림톡 템플릿
"앱을 강제 종료하고 다시 열어주세요. 그래도 이상하면 홈 화면의 [지독해] 아이콘을 길게 눌러 삭제 후, https://brainy-club.com 에서 다시 [홈 화면에 추가]를 눌러주세요."

### 3단계 — 운영자 디버깅
- desktop Chrome DevTools → Application → Service Workers → 현재 SW 버전 / 활성 상태 확인
- Application → Cache Storage → 어떤 캐시에 무엇이 있는지 확인
- Network 탭 → "Disable cache" + "Bypass for network" 체크 후 재현 시도

## SW Kill Switch (긴급 정지)

위험: 캐시 버그가 광범위 신고로 번질 때 사용. 24시간 후 모든 사용자 폰의 SW가 unregister됨.

`jidokhae-web/src/sw.ts`를 다음 빈 SW로 임시 교체 + 배포:
\`\`\`typescript
self.addEventListener('install', () => (self as any).skipWaiting())
self.addEventListener('activate', (e) => {
  e.waitUntil(
    (self as any).registration.unregister()
      .then(() => (self as any).clients.matchAll())
      .then((clients) => clients.forEach((c) => c.navigate(c.url)))
  )
})
\`\`\`

배포 후 24시간 모니터링 → 잠잠해지면 정상 SW 복구 + 원인 분석 PR.

## 배포 시 주의

- 새 버전 prod 배포 후 **30분 모니터링** (Vercel Analytics 에러율 + 사용자 신고)
- 큰 변경(npm 의존성, layout, middleware) 동반 배포는 SW 영향이 클 수 있음
- 배포 직후 본인 PWA에서 새로고침 1회로 자동 갱신 동작 확인

## 캐시 갱신 주기

| 캐시 | 전략 | TTL |
|---|---|---|
| pages (HTML) | NetworkFirst | 무한 (offline fallback only) |
| next-static | CacheFirst | 무한 (build hash로 자동 갱신) |
| fonts | CacheFirst | 1년 |
| app-icons | CacheFirst | 무한 |
| app-manifest | StaleWhileRevalidate | 무한 |
| images | StaleWhileRevalidate | 30일, 최대 64개 |
```

- [ ] **Step 4: Commit**

```bash
cd C:/jidokhae-2nd
git add jidokhae-web/CLAUDE.md CLAUDE.md 검토문서/2026-04-28-pwa-sw-운영-가이드.md
git commit -m "docs(pwa): document service worker conventions and ops guide"
```

---

## Task 9: 브랜치 push + Vercel preview 배포

**Files:** (변경 없음)

- [ ] **Step 1: 원격 push**

```bash
cd C:/jidokhae-2nd
git push -u origin feat/pwa-service-worker
```

Expected: GitHub에 브랜치 생성됨

- [ ] **Step 2: Vercel preview URL 획득**

GitHub 푸시 후 Vercel이 자동으로 preview를 빌드한다. 사용자가 Vercel dashboard에서 preview URL 확인 후 알려줌.

대기 시간: 보통 1~3분.

- [ ] **Step 3: Kakao OAuth redirect URL 확인 (중요)**

preview 도메인이 Kakao Developers의 허용 redirect URL에 등록되어 있어야 로그인 가능.

사용자에게 확인 요청:
1. preview URL (예: `https://jidokhae-web-git-feat-pwa-service-worker-xxx.vercel.app`) 에서 카카오 로그인 시도
2. 만약 "Redirect URI mismatch" 에러 → Kakao Developers 콘솔 + Supabase Auth Redirect URLs에 preview 도메인 추가 필요

기존 preview URL이 동작 중이면 wildcard 등록되어 있을 가능성 높음. 새 preview URL도 자동 동작할 가능성 큼.

---

## Task 10: 모바일 PWA 실측 검증

**Files:** (변경 없음)

- [ ] **Step 1: preview URL을 모바일 Chrome에서 열기**

사용자 작업:
1. 모바일 Chrome에서 preview URL 접속
2. 카카오 로그인 (preview는 prod Supabase 연결이라 실제 계정 사용)
3. 메뉴 → "홈 화면에 추가"
4. 홈 화면 아이콘 탭 → PWA 진입

- [ ] **Step 2: 콜드스타트 측정 (3회 평균)**

PWA 강제 종료 → 다시 열기 → 스플래시("지" 로고)부터 모임 카드 보일 때까지 측정.

- 1회: __초
- 2회: __초
- 3회: __초

목표: P75 FCP **3.54s → 2.5s 안팎** (두 번째 방문부터, 1초 이상 단축)

> **⚠️ 정직한 기대치**: HTML은 NetworkFirst라 TTFB(~0.93s)는 그대로 든다. SW가 줄이는 건 JS/CSS/font 다운로드 시간(~1~1.5s). 즉시 paint를 원하면 별도 app shell 아키텍처가 필요하지만 이번 PR 범위 밖.

- [ ] **Step 3: 캐시 동작 검증**

모바일 Chrome → preview URL → 메뉴 → "PC 버전으로 보기" → DevTools 원격 디버깅 또는 desktop Chrome으로 같은 도메인 접속.

DevTools → Application → Service Workers → activated 확인.

DevTools → Application → Cache Storage → `next-static`, `pages`, `fonts` 캐시에 항목 채워짐 확인.

- [ ] **Step 4: 회귀 점검 (필수)**

다음 흐름이 정상 동작하는지 확인 (preview 환경에서 카드 결제 금지 — 계좌이체로만):

1. 로그아웃 → 로그인 (`/auth/login`)
2. 모임 목록 (`/`)
3. 모임 상세 (`/meetings/[id]`)
4. 신청 → 결제 페이지 진입까지 (실결제는 안 함)
5. 마이페이지 (`/my`)
6. (admin 권한이면) admin 진입 (`/admin`) — NetworkFirst로 동작 (HTML fresh + 정적 자산 캐시 효과)

각 단계에서 화면 정상 + console 에러 없음.

- [ ] **Step 5: 측정 결과 기록**

`/검토문서/2026-04-28-pwa-sw-실측.md` 작성. 측정 수치 + 실측 환경 + 회귀 점검 결과.

```bash
cd C:/jidokhae-2nd
git add 검토문서/2026-04-28-pwa-sw-실측.md
git commit -m "docs(pwa): record sw cold-start measurements on preview"
```

---

## Task 11: PR 생성

**Files:** (변경 없음)

- [ ] **Step 1: PR 작성**

```bash
cd C:/jidokhae-2nd
gh pr create --title "perf(pwa): introduce service worker for cold-start FCP" --body "$(cat <<'EOF'
## Summary
- `@serwist/next` 도입으로 PWA 콜드스타트 FCP 개선 (목표: 3.54s → 2.0s 이하)
- API/auth/admin/_next/data는 NetworkOnly (절대 캐시 안 함)
- _next/static + font + icon만 CacheFirst (revisioned)
- skipWaiting + clientsClaim 으로 새 SW 즉시 점령

## Risk
- 첫 배포 직후 일부 사용자 폰에서 구 JS + 신 HTML 섞임 가능 (clientsClaim으로 자동 reload되지만 100%는 아님)
- iOS Safari PWA의 알려진 캐시 quirk
- 화면 이상 신고 시 SW 캐시가 1순위 의심 대상

## Rollback
- 코드 revert + push (1~2분)
- 사용자 폰 SW kill: 빈 SW로 덮어쓰기 (계획서 Rollback Plan 참조)

## Test plan
- [x] prelaunch 통과
- [x] 로컬 prod build에서 sw.js 생성 + DevTools에서 SW activated 확인
- [x] Vercel preview에서 모바일 PWA 실측 (FCP 측정)
- [x] 회귀 점검 (로그인 → 모임 목록 → 상세 → 신청 흐름)
- [x] admin NetworkOnly 동작 확인

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2: PR URL 사용자에게 전달**

머지는 사용자 판단에 맡김. 머지 후 24시간 모니터링 권고.

---

## Final Check

플랜 완료 시점에 다음 모두 충족되어야 함:

- [ ] `feat/pwa-service-worker` 브랜치에 9개 commit 누적
- [ ] `jidokhae-web/public/sw.js`는 git ignore (커밋 안 됨)
- [ ] preview에서 두 번째 콜드스타트 FCP가 첫 번째보다 명확히 짧음 (1초+ 단축)
- [ ] 회원/운영자 주요 흐름 회귀 없음
- [ ] PR 작성됨, 머지는 사용자 결정 대기

---

## 비판적 자기 검토 (총괄책임자 관점)

이 계획서를 다시 읽으며 발견한 **중대한 약점**들. 실행 전에 사용자와 합의해야 함.

### ⚠️ 약점 1 — 기대 효과가 과장됐을 가능성

PR 본문과 Task 10에 "FCP 3.54s → 2.0s 이하"를 목표로 적었지만, **이 수치는 보장 못 한다**.

이유: 이 계획에서 HTML은 NetworkFirst로 두기로 했다. 즉 **HTML은 매번 서버에서 새로 받는다**. 현재 측정된 FCP 3.54s의 구성을 분해하면:

| 구간 | 시간 | SW로 해결되나? |
|---|---|---|
| TTFB (middleware getUser + HomeContent SSR) | ~0.93s | ❌ 안 됨. HTML은 NetworkFirst |
| HTML 다운로드 | ~0.1s | ❌ 안 됨 |
| JS/CSS bundle 다운로드 | ~1.0s | ✅ 됨 (CacheFirst, 두 번째부터) |
| Font 다운로드 | ~0.3s | ✅ 됨 |
| 첫 paint | ~0.2s | - |

즉 SW는 두 번째 방문에서 **약 1.0~1.5s 단축** 정도가 현실적 기대치. **2.0s 이하는 어렵다.** 정직한 목표는 "P75 FCP **3.54s → 2.5s 안팎**" 이어야 한다.

**조치:** Task 10의 측정 목표를 "2.0s 이하" → "2.5s 안팎(1초 이상 단축)"으로 수정하고, PR 본문도 같은 톤으로 정직하게 적는다.

진짜 즉시 paint를 원한다면 **app shell 패턴**(별도 정적 셸 페이지 + 클라이언트 데이터 fetch)이 필요한데, 그건 이 계획 범위 밖. 대규모 아키텍처 변경.

### ⚠️ 약점 2 — Serwist의 Next.js 16 호환성 검증 안 함

Next.js 16.1.6은 매우 최신. Serwist v9가 명시적으로 Next 16을 지원한다고 검증하지 않은 채 plan을 짰다. 라이브러리가 build 단계에서 깨질 위험.

**조치:** Task 0을 추가한다 — "사전 호환성 검증":
1. `npm view @serwist/next version` 으로 최신 버전 확인
2. GitHub repo에서 Next 16 issue 검색 (open/closed)
3. 호환 안 되면 → 대안 평가 (`@ducanh2912/next-pwa` 또는 manual SW)

이걸 안 하고 진행하다가 Task 4 build에서 깨지면 Task 1~3이 wasted work가 된다.

### ⚠️ 약점 3 — 시각 전환 문제는 이 계획으로 해결 안 됨

사용자 원래 불만은 "지 로고 화면이 길다". 이 계획은 **시간**을 줄이지만, **시각 전환의 어색함**(dark green splash → ivory page)은 그대로다.

SW로 1초 단축해도 사용자가 여전히 "긴 dark green 화면"을 느낄 수 있음. 두 가지 다른 문제를 한 솔루션으로 풀려는 셈.

**조치:** 이 계획 완료 후 **별도 후속 작업**으로 splash 시각 디자인 개선 검토 필요. PR 본문에 "이 PR은 시간만 다룸. 시각 전환은 별건"이라 명시.

### ⚠️ 약점 4 — 브랜치 이름이 프로젝트 컨벤션 어긋남

`perf/pwa-service-worker`로 적었는데, 이 프로젝트 최근 커밋 prefix는 `feat/`, `chore/`, `docs/` 위주. `perf/` 사용 사례 없음.

**조치:** 브랜치 이름을 `feat/pwa-service-worker`로 변경. Task 1 Step 1 명령 수정.

### ⚠️ 약점 5 — Vercel preview의 OAuth redirect 설정 누락 가능

CLAUDE.md에 "Vercel Preview는 prod Supabase에 그대로 연결" 명시. 새 preview 도메인이 Kakao OAuth 허용 redirect URL에 등록 안 되어 있으면 로그인 단계에서 막힘.

기존 preview들이 이미 동작 중이라면 wildcard 등록이 되어 있을 가능성. 아니면 매번 추가해야 함.

**조치:** Task 9 Step 1 직후 확인 단계 추가 — "preview URL의 Kakao OAuth 동작 여부 사용자에게 확인 요청. 안 되면 Kakao Developers 콘솔 + Supabase Auth Redirect URL 추가 필요."

### ⚠️ 약점 6 — `app-icons` 캐시 매처가 manifest 재생성 깨뜨릴 수 있음

`sw.ts`의 매처 8번:
```typescript
matcher: ({ url }) => url.pathname.startsWith('/icon') || url.pathname.startsWith('/manifest'),
```

`startsWith('/icon')`은 `/icon`, `/icon-maskable` 둘 다 맞음 → OK. 하지만 `startsWith('/manifest')`는 manifest.json 자체를 영구 캐시한다. **manifest 변경(예: name, theme_color) 시 사용자 폰의 PWA 정보가 갱신 안 됨.**

**조치:** manifest는 NetworkFirst 또는 StaleWhileRevalidate로 변경. 또는 manifest는 매처에서 제외.

수정안:
```typescript
{
  matcher: ({ url }) =>
    url.pathname === '/icon' ||
    url.pathname === '/icon-maskable' ||
    url.pathname === '/apple-icon' ||
    url.pathname === '/opengraph-image' ||
    url.pathname === '/twitter-image',
  handler: new CacheFirst({ cacheName: 'app-icons' }),
},
{
  matcher: ({ url }) => url.pathname === '/manifest.webmanifest',
  handler: new StaleWhileRevalidate({ cacheName: 'app-manifest' }),
},
```

### ⚠️ 약점 7 — `npm run start` 로컬 prod 시작이 (main) 라우트 인증 막힘

CLAUDE.md 명시: "Local preview limitation: `(main)` route group pages require Kakao OAuth login. ... authenticated pages cannot be tested locally."

Task 6 Step 3에서 "로컬에서 SW 등록 검증" 하라고 했는데, `localhost:3000` 접속 시 `/`은 → `/auth/login` 리다이렉트. 로그인 자체가 OAuth 콜백 도메인 mismatch로 안 됨. 그래도 SW 등록은 `/auth/login` 페이지에서도 발생하므로 검증은 가능. 단지 메인 흐름 캐시 채워지는 건 로컬에서 못 봄.

**조치:** Task 6 Step 3을 명확히 — "`/auth/login` 페이지에서 SW 활성 확인. 메인 흐름 캐시는 preview에서 검증."

### ⚠️ 약점 8 — admin이 NetworkOnly인 게 의도와 맞나?

`/admin`을 NetworkOnly로 둔 이유: 운영자 데이터 stale 방지. 하지만 이렇게 하면 운영자 PWA에서는 SW 캐시 효과 0. admin도 일반 회원처럼 데이터 stale은 NetworkFirst로도 막을 수 있다(HTML은 매번 fresh).

**조치:** admin도 NetworkFirst로 통일하는 게 합리적. NetworkOnly는 `/api/*`만 충분. 다만 보수적 결정으로 admin NetworkOnly 유지해도 큰 손해 없음. 사용자와 합의 필요.

### ⚠️ 약점 9 — TDD 형식이 거의 비어있음

writing-plans 스킬은 TDD 형식("Write the failing test → Run → Implement → Pass → Commit")을 강조한다. 이 계획은 SW 특성상 unit test 불가능해서 verification gates(빌드, DevTools 확인, 실측)로 대체했다. 이건 정직한 한계. 하지만 적어도 **`sw.ts` 자체에 대한 타입 검증 + 빌드 산출물 존재 검증**은 의미 있음. 지금 plan은 이걸 하긴 한다(Task 3 Step 2, Task 4 Step 2-3). OK.

### ⚠️ 약점 10 — 운영 중 화면 이상 신고 시 진단 가이드 부족

CLAUDE.md에 "SW 캐시를 1순위로 의심"이라 한 줄 적었지만, **실무 진단 절차**가 없다. 사용자가 "이상해요" 신고하면 어떻게 처음 5분을 진단할지 명시 필요.

**조치:** `검토문서/2026-04-28-pwa-sw-운영-가이드.md` 신규 작성 (Task 8에 추가):
- 신고 받았을 때 첫 질문 (브라우저, OS, PWA에서 열었나?)
- DevTools로 SW 상태 보는 법
- 강제 reset 안내문 (사용자에게 보낼 알림톡 템플릿)
- kill switch 배포 절차 (Rollback Plan의 빈 SW)

---

## 검토 결과 종합

위 10개 중 **반드시 plan에 반영해야 할 것**:

- [ ] **약점 1 — 기대 효과 정직하게 하향** (Task 10 측정 목표, PR 본문 수정)
- [ ] **약점 2 — Task 0 사전 호환성 검증 추가** (가장 중요. 안 하면 wasted work)
- [ ] **약점 4 — 브랜치 이름** `perf/` → `feat/`
- [ ] **약점 6 — manifest 캐시 전략 분리** (sw.ts 코드 수정)
- [ ] **약점 10 — 운영 가이드 문서 추가** (Task 8 확장)

**사용자 합의 완료 (2026-04-28)**:
- ✅ 약점 3 — 옵션 3 채택: splash 시각 전환은 이번 PR 범위 밖. 별도 후속 작업으로 회원 피드백 모은 뒤 결정
- ✅ 약점 8 — 옵션 B 채택: admin도 NetworkFirst 적용. HTML은 매번 fresh이므로 데이터 stale 위험 없고, 운영자도 SW 효과 누림

**자신감 평가**:
- 약점 2(호환성)가 통과되면 나머지는 모두 작은 조정. 본 계획의 골격은 맞다.
- 약점 1(기대 효과)은 측정 후 실제 수치를 보고 사용자가 판단하면 됨. 진행 자체엔 영향 없음.

**총괄책임자로서 권고**: 위 5개를 수정 반영한 후, 사용자 OK 받고 진행. 약점 2는 plan 시작 전 5분 안에 끝낼 수 있는 사전 작업이므로 미루지 말 것.
