# 지독해 (JIDOKHAE) Design System

> **Literary Warmth** — 책으로 연결되는 따뜻한 지식 커뮤니티

---

## 1. Design Principles

### 철학
지독해의 디자인은 **"지적이고 따뜻한 독서 공간"**을 표현합니다.
깊은 숲의 초록(지성)과 오래된 책장의 구리빛(감성)이 만나,
신뢰감 있으면서도 편안한 모바일 경험을 제공합니다.

### 핵심 원칙
1. **Intellectual Warmth** — 차가운 테크 느낌이 아닌, 서점·독서실의 따뜻함
2. **Refined Simplicity** — 최소한의 요소로 최대한의 정보 전달
3. **Consistent Hierarchy** — 명확한 시각적 계층으로 한눈에 파악
4. **Mobile-First** — 390×844 (iPhone 14) 기준, 한 손 조작 최적화
5. **Accessible** — WCAG 2.1 AA 기준 색상 대비 확보

---

## 2. Colors

### Primary — Deep Forest Green
지적인 독서 감성을 담은 깊은 숲의 초록.
헤더, 배지, 아이콘, 액티브 상태에 사용됩니다.

| Token | Hex | 용도 |
|-------|-----|------|
| `primary-50` | `#F0F7F4` | 배지 배경, 호버 상태 |
| `primary-100` | `#D9EDE3` | 배지 테두리, 연한 배경 |
| `primary-200` | `#B3DBC7` | — |
| `primary-300` | `#7CC0A0` | 그라데이션 끝점, 비활성 텍스트 |
| `primary-400` | `#4A9E76` | 아이콘, 보조 텍스트 |
| `primary-500` | `#2D7D5F` | 그라데이션 시작점, 기본 강조 |
| `primary-600` | `#1B6347` | **CTA 버튼**, 액티브 링크 |
| `primary-700` | `#1B4332` | 로그인 배경, 헤더 텍스트 |
| `primary-800` | `#163528` | 제목 텍스트, 강조 라벨 |
| `primary-900` | `#0F2318` | 최상위 제목 (h1) |

### Accent — Warm Copper/Amber
따뜻한 구리빛. 금액 표시, 경고, 강조 포인트에 사용됩니다.

| Token | Hex | 용도 |
|-------|-----|------|
| `accent-50` | `#FFF8F0` | 경고 배경 |
| `accent-100` | `#FEECDA` | — |
| `accent-200` | `#FCD5B0` | 경고 배지 테두리 |
| `accent-300` | `#F7B87A` | — |
| `accent-400` | `#F09B4B` | — |
| `accent-500` | `#D9802A` | 필수 표시(*), 경고 텍스트 |
| `accent-600` | `#C06A1C` | **금액 표시 (참가비, 결제금액)** |
| `accent-700` | `#9A5318` | — |
| `accent-800` | `#7A4216` | — |
| `accent-900` | `#5C3212` | — |

### Surface — Warm Ivory/Cream
배경과 카드에 사용되는 따뜻한 아이보리.
순수 화이트(`#FFFFFF`) 대신 사용하여 따뜻한 인상을 줍니다.

| Token | Hex | 용도 |
|-------|-----|------|
| `surface-50` | `#FEFCF9` | 카드 배경, 모달 배경 |
| `surface-100` | `#FDF8F1` | 페이지 배경 (body) |
| `surface-200` | `#FAF3E8` | 비활성 배경, 입력 필드 배경 |
| `surface-300` | `#F5EBD9` | 테두리, 구분선 |

### Semantic Colors

| Token | Hex | 용도 |
|-------|-----|------|
| `success` | `#2D7D5F` | 성공 상태 (= primary-500) |
| `warning` | `#D9802A` | 경고 상태 (= accent-500) |
| `error` | `#C43D3D` | 에러, 삭제, 취소 확정 |

### 색상 사용 규칙
- **텍스트**: `primary-900` (제목) → `primary-800` (본문) → `primary-500/70` (보조) → `primary-400` (비활성)
- **금액**: 항상 `accent-600` 사용
- **아이콘**: 기본 `primary-400`, 액티브 `primary-600`
- **테두리**: `surface-300` 기본, 호버 시 `primary-200`
- **배경**: 페이지 `surface-100`, 카드 `surface-50`, 입력필드 `surface-50`

---

## 3. Typography

### 폰트
```
--font-sans: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif
```

### 타이포그래피 스케일

| 레벨 | 크기 | 굵기 | 추적 | 용도 |
|------|------|------|------|------|
| **Display** | `text-4xl` (36px) | `font-extrabold` | `tracking-tight` | 로그인 브랜드명 |
| **H1** | `text-xl` (20px) | `font-extrabold` | `tracking-tight` | 페이지 제목 |
| **H2** | `text-lg` (18px) | `font-extrabold` | `tracking-tight` | 섹션 제목 |
| **H3** | `text-base` (16px) | `font-bold` | — | 카드 제목, 모달 제목 |
| **Body** | `text-sm` (14px) | `font-medium/semibold` | — | 일반 텍스트, 버튼 |
| **Caption** | `text-xs` (12px) | `font-medium/bold` | — | 날짜, 장소, 라벨 |
| **Micro** | `text-[11px]` | `font-bold` | `tracking-tight` | 배지 텍스트 |
| **Nano** | `text-[10px]` | `font-bold` | `tracking-wider` | 운영자 라벨 |

### 규칙
- 제목은 항상 `font-extrabold` + `tracking-tight`
- 버튼은 `font-bold` + `tracking-wide`
- 금액은 `font-bold` (accent-600 색상과 함께)
- 배지는 `font-bold` + `tracking-tight`

---

## 4. Spacing

### 기본 간격 체계
8px 그리드 기반이지만, Tailwind의 4px 단위를 활용합니다.

| Token | 값 | 용도 |
|-------|-----|------|
| `px-5` | 20px | 페이지 좌우 패딩 |
| `pt-4~6` | 16~24px | 페이지 상단 패딩 |
| `pb-6` | 24px | 페이지 하단 패딩 |
| `p-4` | 16px | 카드 내부 패딩 |
| `p-6` | 24px | 모달 내부 패딩 |
| `gap-2~3` | 8~12px | 카드 리스트 간격 |
| `mt-8` | 32px | 섹션 간 간격 |
| `mb-5` | 20px | 제목-콘텐츠 간격 |

### 레이아웃
- **최대 너비**: `max-w-[430px]` (모바일 컨테이너)
- **바텀 네비게이션**: 고정, 하단 safe area 포함 (`pb-safe`)
- **페이지 본문**: `px-5 pt-4~6 pb-6`

---

## 5. Components

### 5.1 Buttons

#### Primary CTA
```
rounded-[var(--radius-lg)]
bg-primary-600
py-4
text-sm font-bold text-white tracking-wide
transition-all hover:bg-primary-700 active:scale-[0.98]
box-shadow: 0 4px 14px rgba(27, 67, 50, 0.25)
```

#### Secondary
```
rounded-[var(--radius-lg)]
bg-surface-50
border: 1px solid surface-300
py-4
text-sm font-bold text-primary-600
transition-all hover:bg-primary-50 active:scale-[0.98]
```

#### Danger
```
rounded-[var(--radius-md)]
border border-error/30
bg-surface-50
py-2.5
text-sm font-bold text-error
hover:bg-error/5
```

#### Disabled
```
rounded-[var(--radius-lg)]
bg-surface-200
py-4
text-sm font-bold text-primary-300
cursor-not-allowed
```

### 5.2 Cards

#### Meeting Card
```
rounded-[var(--radius-lg)]
bg-surface-50
border: 1px solid surface-300
overflow: hidden
box-shadow: var(--shadow-card)
hover: -translate-y-0.5, border → primary-200, shadow → card-hover
```

구조:
1. **Top Accent Bar**: `h-1`, gradient `primary-500 → primary-300`
2. **Content Area**: `p-4`
3. **Date Chip**: `rounded-full bg-primary-50 text-primary-700 border border-primary-100`
4. **Title**: `text-sm font-bold text-primary-900`
5. **Meta Row**: 장소/참여/금액, `text-xs text-primary-400`, 금액은 `text-accent-600`

#### Registration Card
Meeting Card와 동일 구조 + 하단 결제금액 영역:
- 구분선: `border-top: 1px solid surface-300`
- 결제금액: `text-accent-600 font-bold`

### 5.3 Badges

#### 상태 배지 (신청완료, 결제완료)
```
rounded-full
bg-primary-50
border: 1px solid primary-100
text-[11px] font-bold tracking-tight text-primary-700
px-2.5 py-0.5
```

#### 비활성 배지 (취소됨)
```
rounded-full
bg-surface-200
text-[11px] font-bold tracking-tight text-primary-400
px-2.5 py-0.5
```

#### 운영자 라벨
```
rounded-full
bg-primary-50
text-[10px] font-bold tracking-wider uppercase text-primary-600
px-2 py-0.5
```

### 5.4 Form Inputs
```
rounded-[var(--radius-md)]
bg-surface-50
border: 1px solid surface-300
px-3.5 py-3
text-sm font-medium text-primary-900
placeholder: text-primary-300
focus: ring-2 ring-primary-400/40
```

### 5.5 Info Grid (상세 페이지)
```
rounded-[var(--radius-lg)]
bg-surface-100
border: 1px solid surface-300
p-4
```

각 행:
- `py-2.5`, 구분선 `border-bottom: 1px solid surface-300`
- 아이콘: `text-primary-400` (17×17)
- 라벨: `text-xs font-medium text-primary-500/70`
- 값: `text-sm font-semibold text-primary-800`
- 참가비 값: `text-accent-600`

### 5.6 Modal Overlay
```
backdrop: bg-black/40 backdrop-blur-[2px]
container: max-w-sm rounded-[var(--radius-lg)] bg-surface-50 p-6
           box-shadow: var(--shadow-elevated)
           animate: scaleIn 0.2s ease-out
```

### 5.7 Toast
```
fixed bottom-24 left-1/2 -translate-x-1/2 z-50
rounded-full
bg-primary-800
px-5 py-2.5
text-sm font-medium text-white
box-shadow: var(--shadow-elevated)
animate: fadeIn 0.2s ease-out
```

### 5.8 Bottom Navigation
```
container: fixed bottom-0, bg-surface-50, border-top: 1px solid surface-300
           max-w-[430px], safe-area-inset-bottom
```

탭 아이콘:
- Active: `text-primary-700`, top indicator bar `w-8 h-0.5 rounded-full bg-primary-500`
- Inactive: `text-primary-300`

탭 라벨: `text-[11px] tracking-tight`

### 5.9 Empty State
```
py-20 px-4 text-center
icon container: h-16 w-16 rounded-full bg-surface-200 border: 1px solid surface-300
icon: 28×28 text-primary-300 (book icon)
title: text-sm font-semibold text-primary-600
description: text-xs text-primary-400
```

---

## 6. Layout

### 페이지 구조
```
┌─────────────────────────┐
│  Header (fixed top)     │  h: 52px, border-bottom: surface-300
├─────────────────────────┤
│                         │
│  Content (scrollable)   │  px-5, pt-4~6, pb-24 (nav clearance)
│                         │
│                         │
├─────────────────────────┤
│  Bottom Nav (fixed)     │  h: ~60px + safe-area
└─────────────────────────┘
```

### Main Layout Header
- 좌: 닉네임 (`text-sm font-semibold text-primary-800`) + 운영자 배지 (admin일 때)
- 우: 로그아웃 (`text-xs font-medium text-primary-400`)

### Admin Layout Header
- 좌: 뒤로가기 (원형 `w-8 h-8 rounded-full text-primary-600 hover:bg-primary-50`) + "모임 관리"
- 우: 운영자 배지

### Mobile Container
```
<body>
  <div class="mx-auto max-w-[430px] min-h-screen relative"
       style="background-color: var(--color-surface-50)">
    {children}
  </div>
</body>
```

---

## 7. States

### Hover
- 카드: `-translate-y-0.5`, border → `primary-200`, shadow → `card-hover`
- 버튼 (CTA): `bg-primary-700`
- 버튼 (Secondary): `bg-primary-50`
- 링크: `text-primary-600`

### Active / Press
- 버튼: `scale-[0.98]`

### Focus
- 입력 필드: `ring-2 ring-primary-400/40`

### Loading
- 스피너: SVG 원형, `animate-spin`
- 버튼 텍스트: "결제 진행 중...", "취소 처리 중...", "등록 중..."
- 버튼 상태: `disabled opacity-50 cursor-not-allowed`

### Disabled
- 배경: `surface-200`
- 텍스트: `primary-300`
- cursor: `not-allowed`

### Error
- 텍스트: `text-error` (`#C43D3D`)
- 에러 박스: `bg-error/4 border border-error/15 rounded-[var(--radius-md)]`
- 삭제 확인: `border-error/20`

### Empty
- 아이콘: book SVG in `surface-200` circle
- 메시지: `text-primary-600` (주), `text-primary-400` (보조)

---

## 8. Motion

### Keyframe Animations

```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}
```

### 사용 가이드
| 용도 | 애니메이션 | 시간 |
|------|-----------|------|
| 토스트 알림 | `fadeIn` | 0.2s ease-out |
| 모달 등장 | `scaleIn` | 0.2s ease-out |
| 페이지 전환 요소 | `slideUp` | 0.3s ease-out |

### Transitions
- 카드 호버: `transition-all duration-200`
- 버튼: `transition-all` (색상 + scale)
- 링크/텍스트: `transition-colors`

### Micro-interactions
- 버튼 press: `active:scale-[0.98]` (CSS transform)
- 카드 hover: `-translate-y-0.5` (subtle lift)

---

## 9. Shadows

그림자는 따뜻한 초록 기반 tint를 사용합니다 (`rgba(15, 35, 24, ...)`).
순수 검정 그림자 대신 사용하여 전체적으로 조화로운 깊이감을 줍니다.

| Token | 값 | 용도 |
|-------|-----|------|
| `--shadow-card` | `0 1px 3px rgba(15,35,24,0.04), 0 1px 2px rgba(15,35,24,0.03)` | 카드 기본 |
| `--shadow-card-hover` | `0 8px 24px rgba(15,35,24,0.08), 0 2px 6px rgba(15,35,24,0.04)` | 카드 호버 |
| `--shadow-elevated` | `0 12px 32px rgba(15,35,24,0.12), 0 4px 8px rgba(15,35,24,0.06)` | 모달, 토스트 |
| `--shadow-tab` | `0 -1px 4px rgba(15,35,24,0.05)` | 바텀 네비게이션 |
| CTA button | `0 4px 14px rgba(27,67,50,0.25)` | Primary 버튼 전용 |

---

## 10. Border Radius

| Token | 값 | 용도 |
|-------|-----|------|
| `--radius-sm` | `6px` | 소형 요소 |
| `--radius-md` | `12px` | 입력 필드, 테이블, 소형 버튼 |
| `--radius-lg` | `18px` | 카드, CTA 버튼, 모달 |
| `--radius-full` | `9999px` | 배지, 날짜 칩, 아바타 |

---

## 11. Icons

### 스타일
- Feather icon 스타일 (stroke-based, round join)
- `strokeWidth="2"` (일반), `"2.5"` (강조/작은 크기)
- `strokeLinecap="round"` + `strokeLinejoin="round"`

### 크기
| 용도 | 크기 |
|------|------|
| 상세 정보 행 | 17×17 |
| 하단 네비게이션 | 22×22 |
| 뒤로가기 | 18×18 (원형 컨테이너 32×32) |
| 빈 상태 | 28×28 (원형 컨테이너 64×64) |
| 성공/에러 피드백 | 24~32×24~32 (원형 컨테이너 56~64) |
| 새 모임 (+) 버튼 | 14×14 |

### 색상 규칙
- 기본: `text-primary-400`
- 액티브: `text-primary-600` / `text-primary-700`
- 비활성: `text-primary-300`
- 에러: `text-error`
- 성공: `text-primary-600`

---

## 12. Visual Effects

### Noise Texture
페이지 전체에 미세한 노이즈 텍스처를 오버레이하여 종이 같은 질감을 줍니다.
```css
body::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9999;
  opacity: 0.012;
  background-image: url("data:image/svg+xml,...fractalNoise...");
}
```

### Card Accent Bar
카드 상단의 1px 그라데이션 바로 시각적 포인트를 줍니다.
```css
background: linear-gradient(90deg, var(--color-primary-500), var(--color-primary-300));
height: 4px (1 in Tailwind = 0.25rem);
```

### Login Page
- 배경: `primary-700` (#1B4332)
- 장식 원: 반투명 primary-600 원형들이 배경에 겹쳐져 깊이감 제공
- Frosted glass 아이콘 컨테이너: `bg-white/10 backdrop-blur-sm`

---

## 13. 파일 맵

| 파일 | 역할 |
|------|------|
| `src/app/globals.css` | 테마 변수 (색상, 반지름, 그림자, 폰트, 애니메이션) |
| `src/app/layout.tsx` | 루트 레이아웃 (모바일 컨테이너) |
| `src/app/(main)/layout.tsx` | 메인 레이아웃 (헤더 + 바텀 네비) |
| `src/app/(admin)/layout.tsx` | 관리자 레이아웃 (뒤로가기 헤더) |
| `src/app/auth/login/page.tsx` | 로그인 페이지 |
| `src/components/BottomNav.tsx` | 하단 네비게이션 |
| `src/components/LogoutButton.tsx` | 로그아웃 버튼 |
| `src/components/meetings/MeetingCard.tsx` | 모임 카드 |
| `src/components/meetings/MeetingDetailInfo.tsx` | 모임 상세 정보 |
| `src/components/meetings/MeetingActionButton.tsx` | 액션 버튼 + 모달 |
| `src/components/meetings/EmptyMeetings.tsx` | 빈 상태 |
| `src/components/meetings/AdminMeetingSection.tsx` | 관리자 섹션 |
| `src/components/meetings/DeleteMeetingButton.tsx` | 삭제 버튼 |
| `src/components/registrations/RegistrationCard.tsx` | 신청 카드 |
| `src/components/admin/AdminMeetingCard.tsx` | 관리자 모임 카드 |
| `src/components/admin/MeetingForm.tsx` | 모임 생성/수정 폼 |
