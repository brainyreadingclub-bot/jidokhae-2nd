# 지독해 Design Tokens

> "잉크 그린 × 에디토리얼" — 2535 리디자인 (2026-07-07). 그린은 **점(포인트)**이지 면이 아니다. 감귤 코랄은 긴급·희소·에러에만.

All tokens are defined in `src/app/globals.css` via Tailwind v4 `@theme inline`.

## Colors

### Primary — Ink Green (`#127A5A`)
| Token | Hex | Usage |
|-------|-----|-------|
| `primary-50` | `#F3FAF6` | Badges bg, highlights |
| `primary-100` – `200` | `#E3F2EC` – `#CDE9DB` | Borders, light fills |
| `primary-300` | `#8FCBB0` | Muted green accents |
| `primary-400` | `#3E9A78` | Secondary green |
| `primary-500` | `#127A5A` | 브랜드 앵커 — 워드마크·링크·강조 포인트 |
| `primary-600` | `#0d5c43` | Buttons, hover |
| `primary-700` – `800` | `#0B4B37` – `#0A3A2B` | Deep sections |
| `primary-900` | `#072A20` | Title text (near-black) |

### Accent — Citrus Coral (`#F4552A`)
> 긴급·희소·에러·필수 표시에만. 장식·선택·금액에는 금지.

| Token | Hex | Usage |
|-------|-----|-------|
| `accent-50` | `#FFF1EC` | Light accent bg |
| `accent-500` | `#F4552A` | 긴급/희소 포인트, 에디토리얼 룰, 필수(*) |
| `accent-600` | `#D8431C` | Coral hover |

### Neutral — Cool Warm Gray
| Token | Hex | Usage |
|-------|-----|-------|
| `neutral-50` | `#F9FAFB` | bg-base (off-white) |
| `neutral-200` | `#E5E8EB` | Card borders, dividers |
| `neutral-400` | `#B0B8C1` | "마감" status, muted borders |
| `neutral-500` | `#8B95A1` | ≥12px 텍스트/아이콘 stroke만 (대비 2.9:1, 소형 본문 금지) |
| `neutral-600` | `#6B7684` | Secondary text, captions |
| `neutral-900` | `#191F28` | Dark text |

### Surface (legacy, kept for backward compatibility)
`surface-50` through `surface-300` — off-white/그레이 톤 (neutral과 정렬).

### Semantic
| Token | Hex | Usage |
|-------|-----|-------|
| `success` | `#127A5A` | Positive states (ink green) |
| `warning` | `#F4552A` | Caution, closing soon (coral) |
| `error` | `#B5403A` | Destructive, cancel, delete |
| `info` | `#3A8A8C` | Informational |

### Status (meeting cards)
| Token | Hex | Usage |
|-------|-----|-------|
| `status-open` | `#127A5A` | 모집중 |
| `status-closing` | `#F4552A` | 마감임박 |
| `status-full` | `#B0B8C1` | 마감 |
| `status-completed` | `#CDE9DB` | 종료 |
| `status-cancelled` | `#B5403A` | 취소됨 |

## Typography

| Font | Variable | Usage |
|------|----------|-------|
| Noto Serif KR (600, 700) | `font-display` | Brand name, page titles |
| Pretendard | `font-sans` | Body text, UI, labels |
| JetBrains Mono (400, 500) | `font-mono` | Prices, numbers, codes *(정의됨, 아직 미적용 — 향후 사용 예정)* |

### Type Scale
> 토큰은 정의됨. 기존 컴포넌트는 `text-sm`, `text-xl`, `text-xs` 등 Tailwind 기본 클래스를 사용 중. 점진적으로 마이그레이션 예정.

| Class | Size | Line-height | Usage |
|-------|------|-------------|-------|
| `text-display` | 2.5rem | 1.2 | Hero titles |
| `text-heading` | 1.5rem | 1.3 | Page headings |
| `text-subheading` | 1.125rem | 1.4 | Section titles |
| `text-body` | 1rem | 1.6 | Main content |
| `text-caption` | 0.8125rem | 1.5 | Metadata, dates |
| `text-small` | 0.75rem | 1.5 | Badges, tags |

## Spacing

| Variable | Value | Usage |
|----------|-------|-------|
| `--spacing-page` | 20px | Horizontal page padding |
| `--spacing-card` | 16px | Card internal padding |
| `--spacing-section` | 32px | Between major sections |
| `--spacing-stack-sm` | 8px | Tight element groups |
| `--spacing-stack-md` | 16px | Card elements |
| `--spacing-stack-lg` | 24px | Content blocks |

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `radius-sm` | 6px | Badges, tags |
| `radius-md` | 12px | Cards, inputs, buttons |
| `radius-lg` | 16px | Modals, large containers |
| `radius-full` | 9999px | Avatars, pills |

## Shadows (warm green-tinted)

| Token | Usage |
|-------|-------|
| `shadow-sm` / `shadow-card` | Subtle card shadow |
| `shadow-md` / `shadow-card-hover` | Elevated card/hover |
| `shadow-lg` / `shadow-elevated` | Modal overlay |
| `shadow-tab` | Bottom navigation |

## Transitions

| Variable | Value | Usage |
|----------|-------|-------|
| `--transition-fast` | 150ms ease | Hover, focus states |
| `--transition-base` | 250ms ease | General transitions |
| `--transition-slow` | 400ms ease-out | Page transitions |
| `--transition-spring` | 500ms cubic-bezier(0.34, 1.56, 0.64, 1) | Bounce effects |
