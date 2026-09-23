# 지독해 Design Tokens

> **지금 이 저장소에는 스킨이 두 벌 들어 있다.** 회원 화면은 「토스 문법 × 지독해 그린」으로 옮겨가는 중이고, 운영자 화면과 공개 페이지는 「잉크 그린 × 에디토리얼」에 남아 있다.
> 어느 쪽 토큰을 쓸지는 **취향이 아니라 화면이 정한다.** §0을 먼저 본다.

**토큰의 단일 소스는 `src/app/globals.css`다.** 이 문서는 그 파일을 읽기 쉽게 옮긴 것이지 정의가 아니다. 어긋나면 `globals.css`가 맞다.

- 색·타이포·radius·shadow는 `@theme inline` 블록 → **Tailwind 유틸리티 클래스로 나온다** (`bg-tg-100`, `text-brand`)
- spacing·transition은 `:root` 블록 → **유틸리티가 아니다.** `px-[var(--spacing-page)]`처럼 arbitrary value로 쓴다 (§5)

*최종 대조: 2026-08-21 (`globals.css` 전체 대조)*

---

## 0. 어느 스킨을 쓰나

| 화면 | 라우트 | 스킨 | 색 토큰 | 세리프 |
|---|---|---|---|:--:|
| **회원 (신)** | `src/app/(next)/**` · `src/components/next/**` | **토스 문법 × 지독해 그린** | `tg-*` · `brand*` · `warnx*` | ❌ **퇴장** |
| 회원 (구) | `src/app/(main)/**` | 잉크 그린 × 에디토리얼 | `primary-*` · `accent-*` · `neutral-*` | 잔존 (교체 예정) |
| 운영자 | `src/app/(admin)/**` | 잉크 그린 × 에디토리얼 | 〃 | ✅ 유지 |
| 공개 | `src/app/policy/**` · `src/app/auth/**` | 잉크 그린 × 에디토리얼 | 〃 | ✅ 유지 |

**새로 만드는 회원 화면은 `(next)` 스킨이다.** 2026-08-16 결정(`검토문서/DECISIONS.md`)으로 회원 화면 스킨이 토스 문법으로 확정됐고, 그 결정이 **세리프를 회원 화면에서 퇴장시켰다.** `(main)`에 아직 세리프가 남아 있는 것은 결정이 뒤집혀서가 아니라 **아직 교체되지 않은 구 화면**이기 때문이다. 그쪽을 참고해 새 시안을 만들지 않는다.

> ⚠️ `(next)`는 `site_settings.next_ui` 플래그 뒤에 있다(`src/lib/next-ui.ts`). 플래그가 꺼져 있어도 **기준은 `(next)`다.**

### 두 스킨을 섞지 않는다

`neutral-*`과 `tg-*`는 같은 그레이 스케일처럼 보이지만 **10단계 중 4단계가 다르다.**

| 단계 | `neutral-*` | `tg-*` | |
|---|---|---|---|
| 100 | `#F0F2F5` | `#F2F4F6` | ✗ 다름 |
| 300 | `#D4D8DE` | `#D1D6DB` | ✗ 다름 |
| 700 | `#5A6B7A` | `#4E5968` | ✗ 다름 |
| 800 | `#333D48` | `#333D4B` | ✗ 다름 |
| 50 · 200 · 400 · 500 · 600 · 900 | — | — | 값 동일 |

그린도 다르다 — `primary-500 #127A5A`(잉크 그린)와 `brand #0FA873`(토스 스킨 브랜드 그린)은 **다른 색이다.** 한 화면에 두 그린이 같이 있으면 브랜드가 흔들린 것처럼 보인다.

---

## 1. 회원 화면 스킨 — 토스 문법 × 지독해 그린

`(next)` 전용. 근거: `검토문서/DECISIONS.md` 2026-08-16 · 시안 [`docs/설계/mockups/2026-08-16-토스-스킨.html`](../docs/설계/mockups/2026-08-16-토스-스킨.html)

### 그레이 — TDS 10단계

| Token | Hex | Usage |
|---|---|---|
| `tg-50` | `#F9FAFB` | 페이지 바닥 |
| `tg-100` | `#F2F4F6` | **구분에 쓰는 회색 면.** 테두리 대신 이것과 여백으로 나눈다 |
| `tg-200` | `#E5E8EB` | 옅은 면, 구분선 대용 |
| `tg-300` | `#D1D6DB` | 비활성 요소, 인디케이터 |
| `tg-400` | `#B0B8C1` | 비활성 텍스트, 대기 상태 |
| `tg-500` | `#8B95A1` | 보조 메타 |
| `tg-600` | `#6B7684` | 보조 텍스트 — **14px 미만은 여기부터** |
| `tg-700` | `#4E5968` | 본문 보조 |
| `tg-800` | `#333D4B` | 본문 |
| `tg-900` | `#191F28` | 제목, 강조 본문 |

### 브랜드 그린

> **강조 숫자와 상태 표시에만.** 면으로 칠하는 자리는 `brand-bg` 하나뿐이다.

| Token | Hex | Usage |
|---|---|---|
| `brand` | `#0FA873` | 강조 숫자, 활성 인디케이터, 주 버튼 배경 |
| `brand-deep` | `#0C8A5F` | 워드마크, `brand-bg` 위 텍스트 (대비 확보) |
| `brand-bg` | `#E8F7F1` | 연한 그린 면 — 신청 완료 strip, 알림 카드, 라벨 pill |

### 경고

| Token | Hex | Usage |
|---|---|---|
| `warnx` | `#FF6B3D` | 미답변 표시, 읽지 않은 점, 입력 에러 |
| `warnx-bg` | `#FFF0EA` | 경고 아이콘 타일 배경 |

### 그림자

| Token | Value | Usage |
|---|---|---|
| `shadow-toss-card` | `0 2px 12px rgba(25, 31, 40, 0.07)` | 카드 한 겹. **테두리를 대신한다** |

> 유틸리티 클래스가 아니라 `style={{ boxShadow: 'var(--shadow-toss-card)' }}`로 쓰고 있다 (`src/components/next/TossUI.tsx:36`).

### 이 스킨의 규칙

| 규칙 | |
|---|---|
| **테두리 0** | 구분은 회색 면(`tg-100`)과 여백이 한다. `border`를 긋지 않는다 |
| **14px 미만 보조 텍스트는 `tg-600` 이상** | `tg-500`은 2.9:1이라 소형 본문에서 안 읽힌다 |
| **아이콘은 색 있는 둥근 사각형** | 선 아이콘을 흩뿌리지 않는다 |
| **강조 숫자에만 그린** | D-day는 큰 숫자("3일"), 색이 아니라 크기가 강조를 맡는다 |
| **금액은 숫자만** | `원`·`₩` 금지. 숫자는 `tabular-nums` |

---

## 2. 구 스킨 — 잉크 그린 × 에디토리얼

`(admin)` · `policy/*` · `auth/*` · 아직 남은 `(main)`. 근거: 2026-07-12 PR #39.
**회원 화면 신규 작업에는 쓰지 않는다.**

> 그린은 **점(포인트)**이지 면이 아니다. 감귤 코럴은 긴급·희소·에러·필수에만.

### Primary — Ink Green (`#127A5A`)

| Token | Hex | Usage |
|---|---|---|
| `primary-50` | `#F3FAF6` | 배지 배경, 하이라이트 |
| `primary-100` | `#E3F2EC` | 옅은 면 |
| `primary-200` | `#CDE9DB` | 보더, 옅은 채움 |
| `primary-300` | `#8FCBB0` | 낮은 채도 그린 |
| `primary-400` | `#3E9A78` | 보조 그린 |
| `primary-500` | `#127A5A` | 브랜드 앵커 — 워드마크·링크·강조 포인트 |
| `primary-600` | `#0d5c43` | 버튼, hover |
| `primary-700` | `#0B4B37` | 짙은 섹션 |
| `primary-800` | `#0A3A2B` | 〃 |
| `primary-900` | `#072A20` | 제목 텍스트 (near-black) |

### Accent — Citrus Coral (`#F4552A`)

> 긴급·희소·에러·필수 표시에만. 장식·선택·금액에는 금지.

| Token | Hex | | Token | Hex |
|---|---|---|---|---|
| `accent-50` | `#FFF1EC` | | `accent-500` | `#F4552A` |
| `accent-100` | `#FADFD5` | | `accent-600` | `#D8431C` |
| `accent-200` | `#FBC3B0` | | `accent-700` | `#B23516` |
| `accent-300` | `#F79B7C` | | `accent-800` | `#8A2911` |
| `accent-400` | `#F76A45` | | `accent-900` | `#5E1D0C` |

램프 10단계 중 **`accent-800`·`accent-900`만 사용처가 없다**(2026-08-21 기준). `accent-500`이 가장 많이 쓰이고, `accent-200`·`accent-700`도 실제로 쓰인다 — 정의만 해 둔 램프가 아니다.

### Neutral — Warm/Cool Gray

| Token | Hex | Usage |
|---|---|---|
| `neutral-50` | `#F9FAFB` | bg-base (off-white) |
| `neutral-100` | `#F0F2F5` | 옅은 면 |
| `neutral-200` | `#E5E8EB` | 카드 보더, 구분선 |
| `neutral-300` | `#D4D8DE` | 비활성 보더 |
| `neutral-400` | `#B0B8C1` | "마감" 상태, 낮은 채도 보더 |
| `neutral-500` | `#8B95A1` | **≥12px 텍스트/아이콘 stroke만** (대비 2.9:1, 소형 본문 금지) |
| `neutral-600` | `#6B7684` | 보조 텍스트, 캡션 |
| `neutral-700` | `#5A6B7A` | 본문 보조 |
| `neutral-800` | `#333D48` | 본문 |
| `neutral-900` | `#191F28` | 진한 텍스트 |

### Surface / Background

| Token | Hex | | Token | Hex |
|---|---|---|---|---|
| `surface-50` | `#FFFFFF` | | `bg-base` | `#F9FAFB` |
| `surface-100` | `#F9FAFB` | | `bg-surface` | `#FFFFFF` |
| `surface-200` | `#F0F2F5` | | `bg-elevated` | `#FFFFFF` |
| `surface-300` | `#E5E8EB` | | | |

`surface-*`는 하위 호환용으로 남긴 것인데 **여전히 광범위하게 쓰이고 있다**(2026-08-21 기준 200곳 이상). `bg-base`/`bg-surface`/`bg-elevated`는 정의만 있고 유틸리티로 쓰이는 곳이 없다.

> `body`의 배경은 `--color-surface-100`이다 (`globals.css`).

### Semantic

| Token | Hex | Usage |
|---|---|---|
| `success` | `#127A5A` | 긍정 상태 (ink green) |
| `warning` | `#F4552A` | 주의, 마감 임박 (coral) |
| `error` | `#B5403A` | 파괴적 행동, 취소, 삭제 |
| `info` | `#3A8A8C` | 정보 |

### Status (모임 카드 좌측 보더)

| Token | Hex | Usage |
|---|---|---|
| `status-open` | `#127A5A` | 모집중 |
| `status-closing` | `#F4552A` | 마감임박 |
| `status-full` | `#B0B8C1` | 마감 |
| `status-completed` | `#CDE9DB` | 종료 |
| `status-cancelled` | `#B5403A` | 취소됨 |

---

## 3. Typography

| Token | 값 | 어디에 쓰나 |
|---|---|---|
| `font-sans` | Pretendard Variable → Pretendard → 시스템 | **전 화면 기본.** `body`에 걸려 있다 |
| `font-display` | `var(--font-noto-serif)` → Georgia → serif | **운영자 화면·공개 페이지에만.** 아래 참조 |
| `font-mono` | JetBrains Mono → Fira Code → monospace | 계좌번호·금액 일부. **웹폰트를 안 싣는다** — 아래 참조 |

### 세리프(Noto Serif KR)를 어디에 쓰나 — 자리가 좁아졌다

2026-08-16 결정으로 **세리프는 회원 화면에서 퇴장했다.** "지독해다움"은 이제 그린과 책 표지가 맡는다.

| 화면 | 세리프 |
|---|:--:|
| `(next)` — 회원 신 | ❌ **쓰지 않는다.** 현재 사용처 0곳 |
| `(admin)` — 운영자 | ✅ 페이지 제목·워드마크 |
| `policy/*` · `auth/*` — 공개 | ✅ 페이지 제목 |
| `(main)` — 회원 구 | ⚠️ 잔존. **참고 대상이 아니다** — 교체 대기 중인 구 화면이다 |

> 🔴 **이 문서의 이전 판은 세리프를 "Brand name, page titles"라고만 적어 두어, 이것만 읽은 사람이 퇴장이 확정된 세리프를 회원 화면에 다시 넣게 되어 있었다.** 회원 화면 시안에 세리프를 쓰려면 그건 새 결정이고, `DECISIONS.md` 2026-08-16을 뒤집는 일이다.

호출 방식은 유틸리티 클래스가 아니라 인라인이다 — `style={{ fontFamily: 'var(--font-display)' }}`. 웹폰트는 루트 레이아웃에서 `next/font/google`로 싣는다(`src/app/layout.tsx`, weight 600·700, CSS 변수 `--font-noto-serif`).

### `font-mono`는 폰트가 실리지 않는다

`--font-mono`는 JetBrains Mono를 첫 번째로 지정하지만 **어디에서도 그 폰트를 로드하지 않는다.** 실제로는 `Fira Code` 또는 OS 기본 고정폭으로 떨어진다. 숫자를 정렬하려는 목적이면 `font-mono` 대신 **`tabular-nums`**를 쓴다 — `(next)`가 그렇게 하고 있다.

### Type Scale

`@theme`에 정의돼 있어 유틸리티로 나오지만, **대부분의 컴포넌트는 `text-sm`·`text-xl` 같은 Tailwind 기본 클래스나 `text-[17px]` 같은 arbitrary value를 쓴다.** 2026-08-21 기준 이 스케일을 쓰는 곳은 20여 곳뿐이다. 신규 시안에서 이 스케일을 전제하지 않는다.

| Class | Size | Line-height | Usage |
|---|---|---|---|
| `text-display` | 2.5rem | 1.2 | Hero titles |
| `text-heading` | 1.5rem | 1.3 | Page headings |
| `text-subheading` | 1.125rem | 1.4 | Section titles |
| `text-body` | 1rem | 1.6 | Main content |
| `text-caption` | 0.8125rem | 1.5 | Metadata, dates |
| `text-small` | 0.75rem | 1.5 | Badges, tags |

---

## 4. Border Radius · Shadows

### Radius

| Token | Value | Usage |
|---|---|---|
| `radius-sm` | 6px | 배지, 태그 |
| `radius-md` | 12px | 카드, 입력, 버튼 |
| `radius-lg` | 16px | 모달, 큰 컨테이너 |
| `radius-full` | 9999px | 아바타, pill |

> `(next)`는 이 스케일 대신 `rounded-[18px]`·`rounded-[14px]` 같은 arbitrary value를 쓴다. 토스 문법의 둥근 정도가 이 4단계에 안 맞아서다.

### Shadows — 잉크 그린 tint

`(next)`의 `shadow-toss-card`(§1)와 다르다. 이쪽은 그림자에 그린이 섞여 있다.

| Token | Value | Usage |
|---|---|---|
| `shadow-sm` | `0 1px 3px rgba(18,122,90,.06), 0 1px 2px rgba(18,122,90,.04)` | 카드 |
| `shadow-md` | `0 8px 24px rgba(18,122,90,.08), 0 2px 6px rgba(18,122,90,.04)` | 띄운 카드/hover |
| `shadow-lg` | `0 12px 32px rgba(18,122,90,.12), 0 4px 8px rgba(18,122,90,.06)` | 모달 |
| `shadow-tab` | `0 -1px 4px rgba(18,122,90,.05)` | 하단 탭 |

**Legacy alias 3개** — `shadow-card`(=`sm`) · `shadow-card-hover`(=`md`) · `shadow-elevated`(=`lg`). 값이 같으므로 신규 작업에서는 짧은 쪽을 쓴다.

---

## 5. Spacing · Transitions — 유틸리티가 아니다

이 둘은 `@theme inline`이 아니라 **`:root` 블록**에 있다. 그래서 **Tailwind 클래스로 나오지 않는다.** `p-page` 같은 클래스는 존재하지 않는다.

```tsx
// 이렇게 쓴다
className="px-[var(--spacing-page)] py-8"
```

| Variable | Value | Usage |
|---|---|---|
| `--spacing-page` | 20px | 페이지 좌우 패딩 — `policy/*`에서 실제로 쓰임 |
| `--spacing-card` | 16px | 카드 내부 패딩 |
| `--spacing-section` | 32px | 큰 섹션 사이 |
| `--spacing-stack-sm` | 8px | 밀착 그룹 |
| `--spacing-stack-md` | 16px | 카드 요소 |
| `--spacing-stack-lg` | 24px | 콘텐츠 블록 |

| Variable | Value | Usage |
|---|---|---|
| `--transition-fast` | `150ms ease` | hover, focus |
| `--transition-base` | `250ms ease` | 일반 |
| `--transition-slow` | `400ms ease-out` | 페이지 전환 |
| `--transition-spring` | `500ms cubic-bezier(.34,1.56,.64,1)` | 바운스 |

> ⚠️ **transition 4개는 컴포넌트에서 쓰이는 곳이 없다**(2026-08-21 기준). 정의만 남아 있다.

---

## 6. 그 외 `globals.css`에 있는 것

토큰은 아니지만 시안을 실제 화면과 맞추려면 알아야 하는 것들.

| | 내용 |
|---|---|
| **노이즈 텍스처** | `body::before`가 전 화면에 SVG fractalNoise를 `opacity: .012`로 깐다. `position: fixed` · `z-index: 1` · `pointer-events: none` |
| **keyframes 5종** | `fadeIn` · `slideUp` · `scaleIn` · `loginFadeUp` · `loginSlideUp`. 유틸리티 클래스는 없고 `animation` 속성으로 직접 건다 |
| **details/summary 리셋** | 기본 삼각형 마커 제거 (`list-style: none` + `::marker`·`::-webkit-details-marker` 숨김). 접기 UI를 `<details>`로 만들면 마커가 이미 지워져 있다 |

---

## 7. 이 문서를 고치는 법

| | |
|---|---|
| **소유** | 디자인 부서 (`docs/agent-team/공통규약.md` §3 예외). 코드 저장소 안에 있지만 코드가 아니라 **시각 기준 문서**다 |
| **토큰을 새로 만들지 않는다** | 정의는 `globals.css` 하나뿐이다. 필요하면 제안하고 **개발·운영이 넣는다.** 문서에 먼저 적으면 없는 토큰이 시안에 들어간다 |
| **여기 없는 토큰을 시안에 쓰지 않는다** | 이 문서가 뒤처졌을 수 있다. 쓰기 전에 `globals.css`에서 직접 확인한다 |
| **스킨 결정이 바뀌면 §0을 먼저 고친다** | 2026-08-16 세리프 퇴장 결정이 이 문서에 5일간 반영되지 않아, 이 문서만 읽으면 퇴장한 세리프를 회원 화면에 다시 넣게 되어 있었다 |

## 변경 이력

| 날짜 | 내용 |
|---|---|
| **2026-08-21** | **회원 화면 토스 스킨을 문서화.** `globals.css`에 이미 들어 있던 `tg-*` 10개 · `brand`/`brand-deep`/`brand-bg` · `warnx`/`warnx-bg` · `shadow-toss-card` **17개 토큰이 한 줄도 적혀 있지 않았다.** §0 스킨 분기표 신설 — 어느 화면에 어느 토큰을 쓰는지. **세리프 사용 범위를 화면별로 다시 적었다**(2026-08-16 결정 반영 — 회원 화면 퇴장). 누락돼 있던 `accent-100~400`·`700~900`, `neutral-100`·`300`·`700`·`800`, `bg-*` 3개도 채웠다. `font-mono`가 폰트를 로드하지 않는다는 사실, spacing·transition이 유틸리티가 아니라는 사실, transition 4개가 미사용이라는 사실을 명시 |
| 2026-07-07 | 2535 리디자인 — 잉크 그린 × 에디토리얼 (PR #39) |
