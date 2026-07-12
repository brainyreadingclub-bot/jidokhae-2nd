# 지독해 2535 리디자인 코드 마이그레이션 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 "Editorial Organic(딥포레스트그린+테라코타+크림)" 디자인을 확정된 "A안 v2 잉크 그린(#127A5A 앵커 + 감귤 #F4552A 점 + 웜그레이 뉴트럴 + 에디토리얼 세리프)"으로 전면 교체한다.

**Architecture:** 코드베이스가 이미 시맨틱 토큰 클래스(`primary-*`/`accent-*`/`neutral-*`/`surface-*`)를 전면 사용하므로, 마이그레이션의 8할은 `globals.css` `@theme inline` **토큰 값 리맵**으로 자동 전파된다. 나머지는 (a) 폰트/세리프 적용, (b) 로직 리스크가 있는 **구조 리팩터**(MeetingCard 링크 분리 + 카드 참가비 제거 + 카드 좌측 컬러선 제거 + 상태별 CTA + 금액 색 무채색화 + 로그인 B라이트 재구성), (c) **토큰 리맵 자동 전파 밖의 하드코딩 색 수동 교체**(PWA 아이콘/스플래시/OG의 `#0d2920`, loading/error/skeleton/payment의 `gray-*`), (d) 온보딩(웰컴 비율 플립·"3년째" 교체)과 라이브 회원수 RPC + 카운트업, (e) 기계적 잔여 클래스 정리다. 구현은 단일 `feat/redesign-ink-green` 브랜치에 누적하고, 배포는 preview 검증 후 조율된 단일 릴리스로 낸다(토큰이 전역이라 admin/member 색이 같은 커밋에서 바뀜 → 화면별 split 배포 불가).

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS v4 (`@theme inline` in `globals.css`, NOT tailwind.config.ts), Noto Serif KR (next/font) + Pretendard (CDN), Vitest.

**근거 스펙:** `docs/superpowers/specs/2026-07-05-지독해-2535-리디자인-디자인시스템.md` (§1~§8), `docs/expert-panel/2026-07-07-2535-redesign-ui-ux-review.md`. 시안(git 추적, `docs/superpowers/mockups/redesign-2535/`): `phones-reskin.html`(리스킨 검증) · `phones-missing.html`(빠진 화면) · `phones-9.html` · `brand-splash-login.html`(로그인 B라이트) · `brand-onboarding.html`(웰컴+프로필) · `brand-icon-grid.html`·`wordmark-v2.html`(브랜드).

---

## ✅ 결정 확정 (2026-07-07 사용자 승인 — 3건 모두 권장안 채택)

플랜 구조를 좌우하는 3건 모두 권장안대로 확정. 아래 기준으로 Phase가 짜여 있으니 그대로 진행.

### 결정 1 — 토큰 전략: **인플레이스 리맵** ✅ 확정
- `globals.css`의 기존 `--color-primary-*`/`--color-accent-*`/`--color-neutral-*` 값을 새 팔레트로 덮어쓴다. 코드가 이미 시맨틱 클래스를 쓰므로 값만 바꾸면 전 화면 자동 전파 = 토큰 시스템의 설계 의도. 스케일을 둘로 유지하는 복잡도 없음.
- **트레이드오프(수용):** 토큰이 전역이라 admin·member·policy 화면 색이 **같은 커밋에서 동시에** 바뀐다. 따라서 CLAUDE.md의 "안정→운영자→회원" 화면별 split 배포는 이 리스킨엔 적용 불가. 대신 **전체 리스킨을 preview에서 admin+member 함께 검증한 뒤 단일 PR 머지**로 낸다.

### 결정 2 — 전체 색 스케일(50~900) 파생값: **Phase 0 Task 1 표 그대로** ✅ 확정
- 스펙은 앵커 stop만 확정(§1): 잉크그린 `#127A5A`, 진그린텍스트 `#0d5c43`, 연그린배경 `#E3F2EC`/`#F3FAF6`, 연그린보더 `#CDE9DB`; 코럴 `#F4552A`/연코럴보더 `#FADFD5`; 뉴트럴 `#191F28`/`#5A6B7A`/`#6B7684`/`#B0B8C1`/오프화이트 `#F9FAFB`/카드보더 `#E5E8EB`.
- 코드는 50~900 전체 스케일을 소비하므로 중간 stop을 파생. **Phase 0 Task 1의 표값으로 확정**(시안 실측 우선 + 앵커 보간). 어색한 색은 preview 육안 검증 단계에서 미세 조정.

---

## 파일 구조 (변경 지도)

| 파일 | 책임 | 변경 유형 |
|---|---|---|
| `src/app/globals.css` | 토큰 단일 소스 | **리맵**(핵심) |
| `src/app/layout.tsx` | 폰트 로드(Noto Serif KR weight 확장) | 수정 |
| `src/components/meetings/MeetingCard.tsx` | 목록 카드 | **구조 리팩터**(링크 분리·가격 제거·좌측선 제거·상태 CTA) |
| `src/components/meetings/MeetingDetailInfo.tsx` | 상세 정보행 | 수정(금액 무채색·세리프 제목·마스킹 유지) |
| `src/components/meetings/MeetingActionButton.tsx` | 상세 CTA·스텝 할인 표시 | 수정(할인가 그린 예외 유지, '원' 제거) |
| `src/components/meetings/CalendarStrip.tsx` | 주간 스트립 | 수정(활성 pill 잉크그린) |
| `src/components/meetings/MeetingsView.tsx` + `home/*` | 홈·내 모임 섹션 | 수정 |
| `src/components/admin/*` (259 refs) | 운영자 화면 | 기계적 리스킨 |
| `src/app/policy/*` (132 refs) | 공개 페이지 | 기계적 리스킨(후순위) |
| `src/app/manifest.ts`, `src/app/icon.tsx`, `src/app/apple-icon.tsx`, `src/app/icon-maskable/route.tsx`, `src/app/opengraph-image.tsx` | 브랜드 크롬(PWA/OG) — 구 팔레트 하드코딩 | **수동 교체**(Phase 0.5) |
| `src/app/auth/login/page.tsx`, `src/components/LoginClient.tsx` | 로그인 B라이트 + 라이브 회원수 카운트업 | **구조 리팩터**(Phase 6) |
| `src/components/WelcomeScreen.tsx` | 웰컴 다크62/라이트38 플립 + "3년째" 교체 + 카운트업 | 수정(Phase 6) |
| `src/components/ProfileSetup.tsx`, `src/components/RegionPicker.tsx` | 프로필 폼(질문 수집) | 리스킨(색만, Phase 6) |
| `supabase/migration-member-count.sql` | 라이브 회원수 `get_member_count()` RPC | **신규**(Phase 6, 수동 SQL) |
| `src/app/**/loading.tsx`·`error.tsx`, `src/components/skeletons/*`, payment 화면 | 시스템 화면 — `gray-*` 하드코딩 | **수동 교체**(Phase 6) |
| `src/lib/visibility.ts`, `src/lib/staff-slot.ts`, `src/lib/pricing.ts` | 마스킹·할인 로직 | **무변경**(회귀 가드) |
| `src/lib/__tests__/*` | 회귀 테스트 | 유지 + 필요시 추가 |

**불변식(회귀 가드):** `shouldMaskConfirmedCount`(visibility.ts), `getDisplayFee`(staff-slot.ts), `calculateFee`(pricing.ts)의 **동작은 바뀌지 않는다**. 이 리스킨은 표시(색·구조·문구)만 바꾼다. 기존 vitest(`visibility.test.ts`, `pricing.test.ts`)가 전부 통과해야 한다.

---

## Phase 0 — 파운데이션 (토큰 + 폰트)

> 이 Phase 머지 시 전 화면 색이 바뀐다. Phase 1~4 완료 전엔 머지하지 않고 같은 브랜치에 누적.

### Task 0.1: globals.css 토큰 리맵

**Files:**
- Modify: `src/app/globals.css:9-67` (color scales + status)

**제안 스케일(결정 2):** 시안 실측값 우선, 나머지는 앵커 보간.

| 토큰 | 기존 | **신규** | 출처 |
|---|---|---|---|
| primary-50 | #F0F7F4 | `#F3FAF6` | 시안 연그린 카드배경 |
| primary-100 | #D9EDE3 | `#E3F2EC` | 시안 연그린 태그배경 |
| primary-200 | #B3DBC7 | `#CDE9DB` | 시안 연그린 보더 |
| primary-300 | #7CC0A0 | `#8FCBB0` | 보간 |
| primary-400 | #4A9E76 | `#3E9A78` | 보간 |
| primary-500 | #2D7D5F | `#127A5A` | **앵커(잉크그린)** |
| primary-600 | #1B6347 | `#0d5c43` | 시안 진그린 텍스트 |
| primary-700 | #1B4332 | `#0B4B37` | 보간 |
| primary-800 | #163528 | `#0A3A2B` | 보간 |
| primary-900 | #0F2318 | `#072A20` | 보간 |
| accent-50 | #FFF5F2 | `#FFF1EC` | 보간 |
| accent-100 | #FFE8E0 | `#FADFD5` | 시안 연코럴 보더 |
| accent-200 | #FFCBB8 | `#FBC3B0` | 보간 |
| accent-300 | #F5A889 | `#F79B7C` | 보간 |
| accent-400 | #E3825C | `#F76A45` | 보간 |
| accent-500 | #C75B3A | `#F4552A` | **앵커(감귤 코럴)** |
| accent-600 | #A84A2E | `#D8431C` | 보간 |
| accent-700 | #863B25 | `#B23516` | 보간 |
| accent-800 | #6B2F1E | `#8A2911` | 보간 |
| accent-900 | #4E2116 | `#5E1D0C` | 보간 |
| neutral-50 | #FDFBF7 | `#F9FAFB` | 시안 오프화이트 |
| neutral-100 | #FAF6EF | `#F0F2F5` | 시안 보조 보더 |
| neutral-200 | #F0EBE1 | `#E5E8EB` | 시안 카드 보더 |
| neutral-300 | #E4DDD1 | `#D4D8DE` | 시안 |
| neutral-400 | #C4BAA8 | `#B0B8C1` | 시안 비활성 |
| neutral-500 | #9E9484 | `#8B95A1` | 아이콘/≥12px만(주석) |
| neutral-600 | #7A7164 | `#6B7684` | 시안 뮤트(단일) |
| neutral-700 | #5C544A | `#5A6B7A` | 시안 서브텍스트 |
| neutral-800 | #3D3732 | `#333D48` | 시안 |
| neutral-900 | #1F1B17 | `#191F28` | 시안 니어블랙 |
| surface-50 | #FEFCF9 | `#FFFFFF` | 카드 흰 배경 |
| surface-100 | #FDF8F1 | `#F9FAFB` | 오프화이트 |
| surface-200 | #FAF3E8 | `#F0F2F5` | 보조 |
| surface-300 | #F5EBD9 | `#E5E8EB` | 보더 |
| bg-base | #FDFBF7 | `#F9FAFB` | 오프화이트 |
| bg-surface | #FEFCF9 | `#FFFFFF` | |
| bg-elevated | #FFFFFF | `#FFFFFF` | 유지 |
| status-open | #2D7D5F | `#127A5A` | 앵커 |
| status-closing | #D9802A | `#F4552A` | 코럴(마감임박) |
| status-full | #C4BAA8 | `#B0B8C1` | 뮤트 |
| status-completed | #E4DDD1 | `#CDE9DB` | 연그린 |
| status-cancelled | #B5403A | `#B5403A` | 유지 |

또한 shadow의 green-tint rgba(45,90,61,...)는 잉크그린 rgba(18,122,90,...)로 교체(선택, 미세).

- [ ] **Step 1: globals.css 색 스케일 교체**

위 표대로 `src/app/globals.css` 9~67행의 각 `--color-*` 값을 신규값으로 교체한다. `--color-neutral-500` 줄에는 주석 추가:
```css
--color-neutral-500: #8B95A1; /* 대비 2.9:1 — ≥12px 텍스트/아이콘 stroke에만. 소형 본문 금지(§1-3) */
```

- [ ] **Step 2: 빌드/타입 검증**

Run: `cd jidokhae-web && npx tsc --noEmit && npm run build`
Expected: PASS (CSS 값 변경은 타입/빌드에 영향 없음 — 클래스명 불변)

- [ ] **Step 3: 기존 단위 테스트 회귀 확인**

Run: `cd jidokhae-web && npx vitest run`
Expected: 전부 PASS (색만 바뀜, 로직 무변경)

- [ ] **Step 4: 커밋**

```bash
git add src/app/globals.css
git commit -m "feat(redesign): 잉크그린 팔레트로 디자인 토큰 전면 리맵"
```

### Task 0.2: 세리프 폰트 weight 확장

**Files:**
- Modify: `src/app/layout.tsx:14-19`

스펙 §2-1은 워드마크 900, 책제목 700 등 500/600/700/900을 요구한다. 현재는 600/700만 로드.

- [ ] **Step 1: Noto Serif KR weight 배열 확장**

`src/app/layout.tsx`의 `Noto_Serif_KR({ ... weight: ['600','700'] ... })`를 아래로 교체:
```typescript
const notoSerifKR = Noto_Serif_KR({
  subsets: ['latin'],
  weight: ['500', '600', '700', '900'],
  display: 'swap',
  variable: '--font-noto-serif',
})
```

- [ ] **Step 2: 빌드 검증**

Run: `cd jidokhae-web && npm run build`
Expected: PASS

- [ ] **Step 3: 커밋**

```bash
git add src/app/layout.tsx
git commit -m "feat(redesign): Noto Serif KR weight 500/900 확장"
```

---

## Phase 0.5 — 브랜드 크롬 (PWA 아이콘 / 스플래시색 / OG)

> 확정(2026-07-07): 아이콘은 **전부 '지'(讀 아님), 잉크그린 솔리드 배경, 흰 세리프, 감귤 점 제거**. 스플래시는 **라이트(B)**. 이 파일들은 전부 **구 팔레트 `#0d2920` 하드코딩**이라 토큰 리맵으로 자동 안 바뀜 → 수동 교체 필수. 검증: 홈화면 그리드 대비 테스트로 국내앱(토스/카카오/당근) 사이에서 잉크그린 hue로 식별됨 확인 완료.

**Files:**
- Modify: `src/app/manifest.ts`, `src/app/icon.tsx`, `src/app/apple-icon.tsx`, `src/app/icon-maskable/route.tsx`, `src/app/opengraph-image.tsx`
- (수동) `src/app/favicon.ico`

### Task 0.5.1: manifest 색 — 라이트 스플래시

- [ ] **Step 1: background_color/theme_color 교체**

`src/app/manifest.ts`의 `background_color: '#0d2920'` → `'#F9FAFB'`(라이트 스플래시 바탕), `theme_color: '#0d2920'` → `'#127A5A'`(브랜드 그린 주소창/타이틀바). name/short_name/icons 경로는 유지.
> 스플래시는 manifest `background_color` + `/icon`(아래 새 그린 타일)로 자동 합성됨 → 별도 스플래시 이미지 불필요.

- [ ] **Step 2: 빌드 검증** — `cd jidokhae-web && npm run build` → PASS

### Task 0.5.2: 아이콘 3종 — 그린 솔리드 + 흰 '지' + 점 제거

현재 셋 다 `color:'#0d2920'`(다크 그린 텍스트) + 크림 radial 배경 + `#c97b50` 테라코타 점을 렌더. 아래로 교체.

- [ ] **Step 1: `icon.tsx`(192) 교체** — 배경을 잉크그린 솔리드(`linear-gradient(150deg,#127A5A,#0d5c43)`), '지' 글자 `color:'#ffffff'`, `fontFamily` 세리프 유지, **테라코타 점 제거**(해당 `<div>` 삭제). 라운드는 OS가 마스킹하므로 정사각 풀블리드.

- [ ] **Step 2: `apple-icon.tsx`(180) 동일 적용** — 같은 그린 솔리드 + 흰 '지' + 점 제거. iOS는 자체 라운드 처리.

- [ ] **Step 3: `icon-maskable/route.tsx`(512) 동일 적용** — maskable은 safe-zone(80%) 안에 '지'가 들어오도록 폰트 크기만 약간 줄이고, 배경은 **가장자리까지 그린 풀블리드**(마스크 잘림 대비). 점 제거.

- [ ] **Step 4: 빌드 + 육안** — `npm run build` 후 `/icon`·`/apple-icon`·`/icon-maskable` 렌더 확인(그린 타일 + 흰 '지', 점 없음).

### Task 0.5.3: OG 공유 이미지

- [ ] **Step 1: 배경 그린 교체** — `opengraph-image.tsx`의 `#0d2920` → `#072A20`(새 딥 잉크그린). 흰 텍스트/"넷플릭스 말고,"/"독서습관이 생깁니다."/"책으로 연결되는 사람들"/`brainy-club.com` **문구 전부 유지**. 테라코타 계열 강조색 있으면 코럴 `#F4552A`로.

- [ ] **Step 2: 빌드 + `/opengraph-image` 렌더 확인**

### Task 0.5.4: favicon (수동)

- [ ] **Step 1:** `favicon.ico`는 정적 파일이라 코드 생성 불가 → 새 그린 타일 '지'를 16/32/48px .ico로 내보내 교체하거나, 우선순위 낮으면 후순위. **사용자에게 수동 단계로 안내.**

- [ ] **Step 5: 커밋**

```bash
git add src/app/manifest.ts src/app/icon.tsx src/app/apple-icon.tsx src/app/icon-maskable src/app/opengraph-image.tsx
git commit -m "feat(redesign): PWA 아이콘/스플래시/OG 잉크그린 브랜드 크롬 교체"
```

---

## Phase 1 — MeetingCard 구조 리팩터 (로직 리스크 구간)

> 스펙 §4-1·§4-2-1. 카드 전체가 `<Link>`라 CTA 버튼을 중첩 못 함 → 본문 링크 + 별도 CTA로 분리. 참가비 제거·좌측 컬러선 제거·상태별 CTA. **마스킹·할인 로직은 건드리지 않는다.**

**Files:**
- Modify: `src/components/meetings/MeetingCard.tsx` (전체 구조)
- Test: `src/lib/__tests__/visibility.test.ts` (기존 — 회귀 가드로 재실행)

### Task 1.1: 회귀 가드 먼저 고정

- [ ] **Step 1: 마스킹 테스트 실행해 baseline 확인**

Run: `cd jidokhae-web && npx vitest run src/lib/__tests__/visibility.test.ts`
Expected: PASS. 이 테스트는 리팩터 전후 동일하게 통과해야 한다(마스킹 표시 로직 불변 증명).

### Task 1.2: 참가비 제거 + 좌측 컬러선 제거

- [ ] **Step 1: fee 렌더 블록 삭제**

`src/components/meetings/MeetingCard.tsx` 122~124행의 `{formatFee(meeting.fee)}원` 렌더 span 전체를 삭제한다(스펙 §4-1: 카드 참가비 미표기). 사용 안 하게 된 `formatFee` import도 제거.

- [ ] **Step 2: 좌측 4px 컬러 보더 삭제**

63행 인라인 `style={{ borderLeft: '4px solid ...' }}` 제거. 32~39행 `borderColor` 계산 블록도 삭제(스펙 §4-1: 카드 좌측 컬러선 금지 → 상태는 우상단 태그로만).

- [ ] **Step 3: 날짜 메타 그린 pill 확인·중화**

카드 내 날짜 표기가 그린 배경 pill이면 무배경 뉴트럴(`text-neutral-700` ≈ `#5A6B7A`)로 바꾼다(스펙 §4-1 카드 날짜 pill 그린 금지). 흐린 캘린더 아이콘은 유지.

- [ ] **Step 4: 타입/빌드 검증**

Run: `cd jidokhae-web && npx tsc --noEmit`
Expected: PASS (미사용 import 제거 확인)

### Task 1.3: 링크 구조 분리 + 상태별 CTA

스펙 §4-2-1 표: 모집중=`신청하기` 그린 solid / 마감임박(대기가능)=`대기 신청` 고스트 / 마감=`마감` 뮤트 태그. **버튼은 상세로 이동**(인라인 결제 아님). 본인 신청 모임은 이 표 대상 아님(홈 내 모임 섹션이 흡수).

- [ ] **Step 1: 카드 루트를 Link에서 article로 바꾸고 본문만 링크화**

`<Link href=...>` 루트 래퍼를 `<article>`로 바꾼다. 제목·날짜·인원 등 본문 영역을 감싸는 내부 `<Link href={`${basePath}/${meeting.id}`}>`를 두고, 우하단 CTA는 그 Link **바깥**에 형제로 배치(중첩 방지). 카드 hover 효과(`-translate-y-px hover:shadow-md`)는 `<article>`로 이동.

- [ ] **Step 2: 공개 상태 → CTA 분기 함수 추가**

`isRegistered`/`isWaitlisted`(본인 신청)면 CTA 표를 적용하지 않는다(본문 링크만; 상태는 배지가 표기). 그 외 공개 상태로 분기:
```tsx
const isFull = confirmedCount >= meeting.capacity
// 본인 신청/대기가 아닌 카드에서만 CTA 노출
const showCta = !isRegistered && !isWaitlisted
```
CTA 마크업(모두 상세로 이동하는 `<Link>` 또는 마감 태그):
```tsx
{showCta && (
  isFull
    ? <span className="text-xs font-extrabold px-3 py-1.5 rounded-md bg-neutral-100 text-neutral-600">마감</span>
    : <Link href={`${basePath}/${meeting.id}`}
        className={confirmedCountIsClosingSoon
          ? "text-xs font-bold px-4 py-2 rounded-lg border border-primary-200 text-primary-500 bg-white"
          : "text-xs font-bold px-4 py-2 rounded-lg bg-primary-500 text-white"}>
        {confirmedCountIsClosingSoon ? '대기 신청' : '신청하기'}
      </Link>
)}
```
> "마감임박(정원 초과·대기 가능)"의 판정 기준은 상세와 동일해야 한다. 현재 카드는 `isFull`(≥capacity)만 안다 → **정원 참 = 마감 태그**로 단순화하고, "대기 신청" 고스트는 상세 진입 후 노출로 위임한다. (카드에서 대기가능/마감을 구분하려면 대기자 수까지 필요 → YAGNI. 스펙 §4-2-1의 3분기 중 카드는 모집중/마감 2분기만, 대기는 상세에서.) **이 단순화는 결정 3으로 사용자 확인 필요** — 아래 참조.

- [ ] **Step 3: 타입/빌드**

Run: `cd jidokhae-web && npx tsc --noEmit && npm run build`
Expected: PASS

- [ ] **Step 4: 마스킹 회귀 재확인**

Run: `cd jidokhae-web && npx vitest run src/lib/__tests__/visibility.test.ts`
Expected: PASS (Task 1.1과 동일 — 표시 로직 불변 증명)

- [ ] **Step 5: 커밋**

```bash
git add src/components/meetings/MeetingCard.tsx
git commit -m "feat(redesign): MeetingCard 링크 분리 + 참가비/좌측선 제거 + 상태별 CTA"
```

> **결정 3 — 카드 CTA 2분기 단순화** ✅ 확정(2026-07-07): 카드는 **모집중(신청하기 solid) / 마감(뮤트 태그) 2분기**만. "대기 신청"은 상세 진입 후 노출로 위임. 카드가 대기자 수를 몰라도 되니 추가 데이터 페치 불필요(YAGNI). 스펙 §4-2-1 3분기 중 카드는 2분기만 담당.

---

## Phase 2 — 모임 상세 (금액 무채색화 + 세리프 + 스텝 예외)

**Files:**
- Modify: `src/components/meetings/MeetingDetailInfo.tsx:29,90,102`
- Modify: `src/components/meetings/MeetingActionButton.tsx:705,709,713,816`

### Task 2.1: 상세 금액 무채색 + '원' 제거

- [ ] **Step 1: MeetingDetailInfo 금액 색·단위 수정**

`MeetingDetailInfo.tsx:102`의 참가비 표기를 스펙 §3-4로 교체: 값 `14px/600/#191F28`(무채색, `text-neutral-900`), 라벨 "참가비" `12px/500 text-neutral-600`. 기존 `text-accent-600`(테라코타) 제거. `formatFee()` 뒤 `원` 접미사 제거.

- [ ] **Step 2: 제목 세리프 확인**

29행 `<h1 style={{ fontFamily: 'var(--font-display)' }}>` 유지(스펙 §2-1 책제목 세리프). weight를 900으로(`font-black` 또는 인라인). 크기 스펙 32px 반영 검토.

- [ ] **Step 3: 마스킹 유지 확인**

18·90행 `shouldMaskConfirmedCount` 로직 **손대지 않는다**. "함께하는 멤버 N명" 헤더 정합 유지.

### Task 2.2: 스텝 할인 표시 — 그린 예외 유지, '원' 제거

스펙 §3-3 예외: 상세 정보행의 스텝 할인가는 잉크그린 허용(CTA 비인접이라 면화 아님).

- [ ] **Step 1: MeetingActionButton 금액 3종 수정**

`MeetingActionButton.tsx` 705(정가 취소선)/709(할인액)/713(최종가)/816의 `formatFee(...)원`에서 `원` 제거. 정가 취소선 `12px/#B0B8C1`(`text-neutral-400 line-through`), 할인가 `14px/800 text-primary-500`(잉크그린 예외 유지), "스텝 −50%" 태그 유지.

- [ ] **Step 2: 취소 버튼 고스트화(§4-2)**

취소(destructive) 버튼이 그린 solid면 고스트로 강등: 흰 배경 + `text-neutral-700`(#5A6B7A) + `border-neutral-300`(#DDE2E7 근사). 실수 탭 방지.

- [ ] **Step 3: 스텝 할인 회귀 테스트**

Run: `cd jidokhae-web && npx vitest run src/lib/__tests__/pricing.test.ts`
Expected: PASS (표시만 바뀜, `calculateFee`/`getDisplayFee` 불변)

- [ ] **Step 4: 타입/빌드 + 커밋**

```bash
cd jidokhae-web && npx tsc --noEmit && npm run build
git add src/components/meetings/MeetingDetailInfo.tsx src/components/meetings/MeetingActionButton.tsx
git commit -m "feat(redesign): 상세 금액 무채색화 + 스텝 할인가 그린 예외 + 취소 고스트"
```

---

## Phase 3 — 홈 / 캘린더 / 내 모임 섹션

**Files:**
- Modify: `src/components/meetings/CalendarStrip.tsx:86-94`
- Modify: `src/components/meetings/MeetingsView.tsx` + `src/components/home/HomeContent.tsx`

### Task 3.1: CalendarStrip 활성 pill 잉크그린

- [ ] **Step 1: 선택/오늘/보유 상태 색 확인**

`CalendarStrip.tsx:86-94`는 이미 `bg-primary-600`/`bg-primary-50`/`text-primary-*`를 사용 → Phase 0 리맵으로 자동 잉크그린화됨. 일요일 `text-accent-400`(코럴)이 과하지 않은지 육안 확인, 과하면 `text-neutral-600`으로. **코드 변경은 최소** — 리맵으로 대부분 해결.

- [ ] **Step 2: preview 육안 검증**

preview에서 주간 스트립 활성일이 잉크그린 solid인지 확인.

### Task 3.2: 내 모임 스트립 / D-day

- [ ] **Step 1: 신청완료 스트립 연그린 확인(§4-5)**

`RegistrationHero`/내 모임 스트립이 `bg-primary-50`(#F3FAF6)+`border-primary-200`(#CDE9DB)+✓ 그린을 쓰는지 확인 → 리맵으로 자동. **연그린 카드 배경은 "내 모임" 단건에만**(§1-1 그린=점 규칙). 목록 카드는 흰 배경 유지(Phase 1에서 확보).

- [ ] **Step 2: D-day 임박 색(§4-4)**

D-3 이하 `text-accent-500`(코럴), 여유는 그린/뮤트 — 기존 로직 유지, 리맵으로 색만 갱신. 위치·형태 통일 확인.

- [ ] **Step 3: 빌드 + 커밋**

```bash
cd jidokhae-web && npm run build
git add src/components/meetings/CalendarStrip.tsx src/components/meetings/MeetingsView.tsx src/components/home/HomeContent.tsx
git commit -m "feat(redesign): 홈 캘린더/내 모임 잉크그린 정합"
```

---

## Phase 4 — 운영자 화면 리스킨 (259 refs)

> 대부분 리맵으로 자동. 잔여는 하드코딩 hex/부정합 클래스 정리.

**Files:**
- Modify: `src/components/admin/*.tsx`, `src/app/(admin)/*`

- [ ] **Step 1: admin 하위 하드코딩 색 스캔**

Run: `cd jidokhae-web && grep -rn "#[0-9A-Fa-f]\{6\}\|text-accent-\|bg-primary-" src/components/admin src/app/\(admin\)`
하드코딩된 구 팔레트 hex(예: `#2D7D5F`, `#C75B3A`, 크림 계열)를 찾아 토큰 클래스 또는 신규 hex로 교체.

- [ ] **Step 2: 금액 표기 '원'/색 점검**

admin 테이블(DepositConfirmTable/RefundWaitingTable/VenueSettlementTable)의 금액은 정산 맥락이라 '원' 유지 여부를 사용자 정책대로(현행 유지 권장 — 회원 화면만 무단위). 색은 무채색 확인.

- [ ] **Step 3: 빌드 + 커밋**

```bash
cd jidokhae-web && npm run build
git add src/components/admin src/app/\(admin\)
git commit -m "feat(redesign): 운영자 화면 잉크그린 리스킨"
```

---

## Phase 5 — 공개 페이지 + 잔여 정리 + 전체 회귀

**Files:**
- Modify: `src/app/policy/*` (132 refs), 잔여 컴포넌트(ProfileSetup/RegionPicker/LoginClient/Footer/WelcomeScreen/skeletons 등)

- [ ] **Step 1: 전역 하드코딩 구 팔레트 스캔**

Run: `cd jidokhae-web && grep -rn "#2D7D5F\|#C75B3A\|#1B4332\|#FDFBF7\|crema\|cream" src`
잔여 구 팔레트 hex를 신규 토큰/hex로 교체.

- [ ] **Step 2: 폰트 정합**

세리프가 스펙 §2 경계(워드마크·히어로·책/모임 제목에만) 밖에서 새지 않는지 확인. 본문/UI/메타/금액/버튼/태그는 Pretendard.

- [ ] **Step 3: 전체 QA 파이프라인**

Run: `cd jidokhae-web && npm run prelaunch`
Expected: lint + tsc + test + build 전부 PASS

- [ ] **Step 4: preview 배포 + admin/member 육안 검증**

Vercel preview에서 (a) 홈 목록/카드 CTA 분기, (b) 상세 금액 무채색+스텝 할인 그린, (c) 내 모임 연그린 단건, (d) admin 화면, (e) 마감/마감임박 상태색을 시안(phones-reskin.html)과 대조.

- [ ] **Step 5: 커밋**

```bash
git add src/app/policy src/components
git commit -m "feat(redesign): 공개 페이지/잔여 컴포넌트 리스킨 + 폰트 경계 정합"
```

---

## Phase 6 — 온보딩 (로그인/웰컴/프로필/스플래시) + 시스템 화면 + 라이브 회원수

> 확정(2026-07-07): 스플래시/로그인 **B 라이트**(오프화이트 + 잉크그린 워드마크). 로그인 하단 카카오 버튼은 그림자·카드 없이 얇은 여백만으로 가볍게(두툼함 제거). **회원수는 하드코딩/`settings['member_count']` 폐기 → 실제 `profiles` 라이브 COUNT를 `get_member_count()` SECURITY DEFINER RPC로 조회**(비로그인 anon RLS로 못 세므로 카운트-only PII-0 RPC). 로그인/웰컴 모두 낮은 값→실수치 ~2.6초 ease-out **카운트업**(진입 1회). 카피는 유지 원칙 — 로그인 헤드라인 "책으로 연결되는 사람들" 현행 유지(위트는 회원 대상 후속 테스트), 웰컴 "넷플릭스 말고, 독서습관이 생깁니다" 유지, **"3년째"만 안 늙는 "경주·포항에서 꾸준히"로 교체**(연차 하드코딩이라 이미 틀림). 시안: `docs/superpowers/mockups/redesign-2535/brand-splash-login.html`, `brand-onboarding.html`.

**Files:**
- Create: `supabase/migration-member-count.sql`
- Modify: `src/app/auth/login/page.tsx`, `src/components/LoginClient.tsx`, `src/components/WelcomeScreen.tsx`, `src/components/ProfileSetup.tsx`, `src/components/RegionPicker.tsx`
- Modify(시스템): `src/app/(admin)/loading.tsx`, `src/app/(main)/loading.tsx`, `src/app/(main)/meetings/[id]/loading.tsx`, `src/app/(admin)/error.tsx`, `src/app/(main)/error.tsx`, `src/components/skeletons/*` (5개), `src/app/(main)/meetings/[id]/payment-redirect/page.tsx`, `src/app/(main)/meetings/[id]/payment-fail/page.tsx`, `src/app/(main)/meetings/[id]/confirm/page.tsx`

### Task 6.1: 라이브 회원수 RPC

> 비로그인 로그인 페이지는 anon 키 + RLS라 `profiles`를 직접 COUNT 못 함 → 카운트만 반환하는 SECURITY DEFINER RPC 신설(PII 노출 0).

- [ ] **Step 1: RPC 마이그레이션 파일 작성**

Create `supabase/migration-member-count.sql`:
```sql
-- 비로그인 로그인/웰컴 화면 회원수 카운트업용. 카운트만 반환(PII 0).
create or replace function public.get_member_count()
returns integer
language sql
security definer
set search_path = ''
stable
as $$
  select count(*)::int from public.profiles;
$$;

grant execute on function public.get_member_count() to anon, authenticated;
```

- [ ] **Step 2: (사용자 수동) prod Supabase SQL Editor에서 실행**

이 SQL은 코드가 아니라 DB 변경이므로 **사용자에게 수동 실행 안내**(MCP는 dead project라 금지 — `project_supabase_mcp_warning.md`). 실행 후 `select get_member_count();`로 숫자 반환 확인.

- [ ] **Step 3: 커밋(마이그레이션 파일 추적)**

```bash
git add supabase/migration-member-count.sql
git commit -m "feat(redesign): 라이브 회원수 get_member_count() RPC 추가"
```

### Task 6.2: 로그인 페이지 라이브 카운트 페치

- [ ] **Step 1: auth/login/page.tsx에서 RPC 호출**

`src/app/auth/login/page.tsx`가 현재 `getSiteSettings()`만 넘긴다. anon Supabase 클라이언트로 `get_member_count()` RPC를 호출해 `memberCount`를 함께 넘긴다:
```tsx
import { getSiteSettings } from '@/lib/site-settings'
import { createClient } from '@/lib/supabase/server'
import LoginClient from '@/components/LoginClient'

export default async function LoginPage() {
  const settings = await getSiteSettings()
  const supabase = await createClient()
  const { data: memberCount } = await supabase.rpc('get_member_count')
  return <LoginClient settings={settings} memberCount={memberCount ?? null} />
}
```
> `createClient` 경로/시그니처는 `src/lib/supabase/server.ts` 실제 export에 맞춰 확인 후 사용(await 여부 포함).

- [ ] **Step 2: 타입/빌드** — `cd jidokhae-web && npx tsc --noEmit` → PASS

### Task 6.3: LoginClient B-라이트 리스트럭처 + 카운트업

> 현재 LoginClient는 다크 히어로(primary-900). 시안 `brand-splash-login.html`의 B 라이트로 재구성.

- [ ] **Step 1: props에 memberCount 추가 + 스테일 소스 제거**

`src/components/LoginClient.tsx` props에 `memberCount: number | null` 추가. 16행 `const memberCount = settings['member_count'] ?? '250'`(스테일) **삭제**. 표시는 아래 카운트업 상태값 사용.

- [ ] **Step 2: 배경/워드마크/헤드라인 라이트화**

루트 배경 `bg var(--color-primary-900)` → 오프화이트(`bg-neutral-50` = `#F9FAFB`). 워드마크 "지독해"는 세리프 `text-primary-500`(잉크그린, ~40px `font-black`). 태그 "경주 · 포항 독서모임" `text-neutral-600`. 코럴 rule(`bg-accent-500` 얇은 선). 헤드라인 세리프 "책으로<br>연결되는<br><b>사람들</b>"(현행 카피 유지, `word-break:keep-all`).

- [ ] **Step 3: 하단 카카오 버튼 경량화(두툼함 제거)**

카카오 버튼을 감싼 카드/그림자 제거 → 얇은 여백만으로 앵커. 버튼색 `#FEE500` 불변. 위 proof "지금 <b>N</b>명이 함께 읽고 있어요"의 N을 카운트업 span으로. 하단 "모임 일정 먼저 보기"(peek) 유지.

- [ ] **Step 4: 카운트업 애니메이션**

`'use client'` 컴포넌트에 진입 시 1회 카운트업 `useEffect` 추가. `memberCount`가 목표, 시작은 목표의 ~60%(예: `Math.round(memberCount*0.6)`), `dur≈2600ms`, ease-out `e=1-Math.pow(1-p,3)`, `requestAnimationFrame`. `memberCount`가 null이면 애니메이션 없이 숨김/기존 폴백. **실수치를 넘겨 무한 증가시키지 않는다**(거짓 금지).

- [ ] **Step 5: 타입/빌드** — `npx tsc --noEmit && npm run build` → PASS

### Task 6.4: WelcomeScreen 리스킨 (다크 62% / 라이트 38% 플립 + 카피 교체)

> 시안 `brand-onboarding.html` 웰컴. 현재 `flex-[2]`(다크40)/`flex-[3]`(라이트60)라 하단 하양이 텅 빔 → **다크 히어로 우세로 뒤집기**.

- [ ] **Step 1: 비율 플립 + 좌측 정렬**

`src/components/WelcomeScreen.tsx` 상단 다크 섹션 `flex-[2]` → `flex-[1.6]`(약 62%), 하단 라이트 `flex-[3]` → `flex-[1]`(약 38%). 다크 섹션은 좌측 정렬 에디토리얼(`text-left`), 한글 `word-break:keep-all`. 하단 라이트는 가운데 정렬 유지.

- [ ] **Step 2: "3년째" → 안 늙는 문구 교체**

92~96행 리드의 "…{active_regions_label}, 3년째." → "…경주·포항에서 꾸준히." (연차 하드코딩 제거). "넷플릭스 말고, / 독서습관이 생깁니다." 헤드라인은 **유지**. "독서습관이 생깁니다"에 `word-break:keep-all`로 중간 잘림 방지.

- [ ] **Step 3: 회원수 라이브 카운트업**

리드의 "매주 모이는 사람들, {memberCount}명"의 `settings['member_count'] ?? '250'`(스테일) 제거. WelcomeScreen도 라이브 `memberCount`를 받도록 props 확장(웰컴 렌더 상위에서 `get_member_count()` 결과 전달) + 로그인과 동일 카운트업 `useEffect`. 상위에서 이미 회원수를 안 넘기면 넘기도록 배선.
> 웰컴은 로그인 직후(로그인 상태) 렌더되므로 authenticated 클라이언트로도 COUNT 가능하나, 단일 진입점으로 동일 RPC 재사용 권장.

- [ ] **Step 4: 토큰 색 확인** — 다크 히어로 `bg var(--color-primary-900)`(#072A20), 블롭 accent/primary, CTA `bg-primary-600` → 리맵으로 자동 잉크그린화. 육안 확인.

- [ ] **Step 5: 타입/빌드** — `npx tsc --noEmit && npm run build` → PASS

### Task 6.5: ProfileSetup / RegionPicker 토큰 정합

- [ ] **Step 1: 색 토큰 자동 전파 확인**

`src/components/ProfileSetup.tsx`(라벨 `text-primary-700`, 필수 별 `text-accent-500`, CTA `bg-primary-600`)와 `RegionPicker.tsx`(선택 칩 그린 채움)는 시맨틱 클래스라 리맵으로 자동. 하드코딩 hex만 스캔:
Run: `cd jidokhae-web && grep -n "#[0-9A-Fa-f]\{6\}" src/components/ProfileSetup.tsx src/components/RegionPicker.tsx`
발견 시 신규 토큰/hex로 교체. 필드/순서/문구는 **무변경**(리스킨은 색만).

- [ ] **Step 2: 빌드** — `npm run build` → PASS

### Task 6.6: 시스템 화면 하드코딩 그레이 → 뉴트럴 토큰

> loading/error/skeleton/payment 화면은 `bg-gray-*`/`text-gray-*` 하드코딩이라 토큰 리맵 자동 전파 밖.

- [ ] **Step 1: 하드코딩 gray 스캔**

Run: `cd jidokhae-web && grep -rn "gray-\|#0d2920\|#[0-9A-Fa-f]\{6\}" src/app/\(main\)/loading.tsx src/app/\(admin\)/loading.tsx "src/app/(main)/meetings/[id]/loading.tsx" src/app/\(main\)/error.tsx src/app/\(admin\)/error.tsx src/components/skeletons "src/app/(main)/meetings/[id]/payment-redirect/page.tsx" "src/app/(main)/meetings/[id]/payment-fail/page.tsx" "src/app/(main)/meetings/[id]/confirm/page.tsx"`

- [ ] **Step 2: 뉴트럴 토큰으로 교체**

`bg-gray-100/200` 스켈레톤 → `bg-neutral-100/200`(오프화이트 계열), `text-gray-500` → `text-neutral-600`(#6B7684). payment-redirect "결제를 확인하고 있습니다…" 그레이 → 뉴트럴. 스피너/배경도 오프화이트 톤 정합. 문구·구조 무변경, 색만.

- [ ] **Step 3: 타입/빌드** — `npx tsc --noEmit && npm run build` → PASS

- [ ] **Step 4: preview 육안 검증** — 로그인(라이트+카운트업)·웰컴(다크62/라이트38)·프로필폼·로딩/에러/결제 화면을 시안과 대조.

- [ ] **Step 5: 커밋**

```bash
git add src/app/auth/login/page.tsx src/components/LoginClient.tsx src/components/WelcomeScreen.tsx src/components/ProfileSetup.tsx src/components/RegionPicker.tsx "src/app/(main)/loading.tsx" "src/app/(admin)/loading.tsx" "src/app/(main)/meetings/[id]/loading.tsx" "src/app/(main)/error.tsx" "src/app/(admin)/error.tsx" src/components/skeletons "src/app/(main)/meetings/[id]/payment-redirect/page.tsx" "src/app/(main)/meetings/[id]/payment-fail/page.tsx" "src/app/(main)/meetings/[id]/confirm/page.tsx"
git commit -m "feat(redesign): 온보딩(로그인 B라이트/웰컴 플립/프로필) + 시스템 화면 + 라이브 회원수 카운트업"
```

---

## Phase 7 — 문서 정리 (구 팔레트 설명 문서 갱신)

> 리디자인 **코드가 다 끝난 뒤** 실행. 먼저 하면 문서는 "잉크그린"인데 코드는 옛색이라 오히려 불일치. 이 Phase는 리스킨 브랜치의 **마지막 커밋**으로 넣는다.

**Files:**
- Modify: `jidokhae-web/DESIGN_TOKENS.md` (구 팔레트 전체 설명서)
- Modify: `CLAUDE.md`(프로젝트 루트) 디자인 시스템 설명 줄
- Modify: `jidokhae-web/CLAUDE.md` (있으면 디자인 언급)
- Modify(후순위): `docs/learning/part1-기초/03-우리-기술스택.md` 팔레트 언급
- **무변경(과거 기록):** `docs/expert-panel/2026-03-24-brand-color.md` — 그때 결정의 역사라 그대로. 새 방향은 `2026-07-05-redesign-ink-green-a-critique.md`가 이미 시간순으로 대체.

- [ ] **Step 1: DESIGN_TOKENS.md 갱신**

`jidokhae-web/DESIGN_TOKENS.md`의 팔레트 표(딥포레스트/테라코타/크림)를 Phase 0 Task 1의 새 잉크그린 스케일로 교체. 실제 `globals.css` 최종값과 대조해 일치시킨다(문서-코드 동기).

- [ ] **Step 2: CLAUDE.md 디자인 줄 교체**

프로젝트 `CLAUDE.md`의 `Design system: "Editorial Organic" — Primary: Deep Forest Green … Warm Ivory/Cream` 문장을 새 시스템("잉크그린 #127A5A + 감귤 #F4552A 포인트 + 웜그레이 뉴트럴 + 오프화이트")으로 갱신. `jidokhae-web/CLAUDE.md`도 디자인 언급 있으면 동일 갱신.

- [ ] **Step 3: (후순위) 학습서 팔레트 언급 정정** — `docs/learning/.../03-우리-기술스택.md`에 색 언급 있으면 갱신. 낮은 우선순위.

- [ ] **Step 4: 로드맵 M11 관계 메모**

`roadmap/milestones-phase3.md`의 M11(디자인 토큰 통합+접근성)에 "이 리디자인이 상당부분 선행 완료 → M11 잔여 범위 재조정 필요" 한 줄 주석. 범위 축소는 별도 판단.

- [ ] **Step 5: 커밋**

```bash
git add jidokhae-web/DESIGN_TOKENS.md CLAUDE.md jidokhae-web/CLAUDE.md docs/learning roadmap/milestones-phase3.md
git commit -m "docs(redesign): 구 팔레트 설명 문서 잉크그린으로 갱신"
```

---

## 배포 (단일 조율 릴리스)

토큰이 전역이라 화면별 split 불가 → **전체 리스킨을 한 번에**:
1. `feat/redesign-ink-green` 브랜치 전 Phase 누적 완료 + `npm run prelaunch` 통과.
2. Vercel preview에서 admin+member 함께 검증(시안 대조).
3. 단일 PR → main 머지. 머지 직후 이상 시 `git revert -m 1 <merge-sha>`로 즉시 롤백(코드만; DB schema 변경 없음).
4. 250명 노출이므로 저트래픽 시간대 머지 권장.

## 병행 잔재 점검 (CLAUDE.md 2026-04-27 교훈)

리스킨은 표시만 바꾸지만, 확인: (1) 카드 CTA 분기가 마감/신청완료/입금대기에서 초록·박스 면화 안 하는지, (2) 마스킹된 카드에서도 CTA 표가 정합적인지, (3) 본인 신청 모임이 전체 일정에서 제외돼 CTA 표 대상 안 되는지, (4) admin 금액 '원' 정책 일관성.

---

## Self-Review 체크

- **스펙 커버리지:** §1 색(Phase0) · §2 폰트(Phase0.2/5) · §3 금액(Phase1 카드제거/Phase2 상세) · §4-1 카드규칙(Phase1) · §4-2/4-2-1 CTA(Phase1/2) · §4-4 D-day(Phase3) · §4-5 스트립(Phase3) · §4-6 텍스처(코드 미도입 — grain은 시안 전용, 실서비스 미적용으로 스킵) — 전부 매핑됨.
- **브랜드 크롬/온보딩 커버리지:** PWA 아이콘·스플래시·OG(Phase0.5) · 로그인 B라이트+카운트업(Phase6.2/6.3) · 웰컴 플립+"3년째"교체(Phase6.4) · 프로필폼(Phase6.5) · 시스템 화면 gray 하드코딩(Phase6.6) · 라이브 회원수 RPC(Phase6.1) — 확정(2026-07-07) 전부 매핑됨.
- **하드코딩 색 예외:** 토큰 리맵 자동 전파 밖 = manifest/icon/OG(Phase0.5) + loading/error/skeleton/payment `gray-*`(Phase6.6). 이 둘을 놓치면 구 팔레트 잔존 → 명시적 Task로 커버.
- **로직 불변:** visibility/pricing/staff-slot 무변경 + 각 Phase 회귀 테스트로 가드. 온보딩은 색·비율·문구("3년째"만)만 변경, 프로필 필드/순서/신청·결제 로직 무변경.
- **회원수 정직성:** 카운트업 목표는 실제 `get_member_count()` 반환값. 실수치 초과 무한증가 금지(거짓). null이면 폴백/숨김.
- **문서-코드 동기:** 구 팔레트 설명 문서(DESIGN_TOKENS.md·CLAUDE.md·학습서)는 코드 완료 후 Phase 7에서 마지막에 갱신(먼저 하면 불일치). 과거 결정 기록(2026-03-24 brand-color)은 무변경.
- **시안 보존:** 시안이 gitignore된 `.superpowers/`에만 있어 유실 위험 → `docs/superpowers/mockups/redesign-2535/`로 복사·추적. 플랜 참조 경로도 이 추적 경로로 갱신 완료.
- **결정 3건 확정(2026-07-07):** 결정1(인플레이스 리맵)·결정2(Task1 스케일 표)·결정3(카드 CTA 2분기) 모두 사용자 승인 완료 — 착수 준비됨.
