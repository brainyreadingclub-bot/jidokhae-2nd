# 지독해 Design Tokens

> "따뜻한 독립서점에서 발행하는 정기 간행물" — Editorial × Organic aesthetic

All tokens are defined in `src/app/globals.css` via Tailwind v4 `@theme inline`.

## Colors

### Primary — Deep Forest Green
| Token | Hex | Usage |
|-------|-----|-------|
| `primary-50` | `#F0F7F4` | Badges bg, highlights |
| `primary-100` – `200` | `#D9EDE3` – `#B3DBC7` | Borders, light fills |
| `primary-500` | `#2D7D5F` | Brand green, success |
| `primary-600` | `#1B6347` | Buttons, links |
| `primary-700` | `#1B4332` | Login bg, headings |
| `primary-900` | `#0F2318` | Title text |

### Accent — Warm Terracotta
| Token | Hex | Usage |
|-------|-----|-------|
| `accent-50` | `#FFF5F2` | Light accent bg |
| `accent-500` | `#C75B3A` | CTA highlights, "신청완료" badge |
| `accent-600` | `#A84A2E` | Prices, fee display |

### Neutral — Warm Gray
| Token | Hex | Usage |
|-------|-----|-------|
| `neutral-50` | `#FDFBF7` | bg-base (parchment) |
| `neutral-200` | `#F0EBE1` | Card borders, dividers |
| `neutral-400` | `#C4BAA8` | "마감" status, muted borders |
| `neutral-500` | `#9E9484` | Secondary text, captions |
| `neutral-900` | `#1F1B17` | Dark text |

### Surface (legacy, kept for backward compatibility)
`surface-50` through `surface-300` — Warm Ivory/Cream tones.

### Semantic
| Token | Hex | Usage |
|-------|-----|-------|
| `success` | `#2D7D5F` | Positive states |
| `warning` | `#D9802A` | Caution, closing soon |
| `error` | `#B5403A` | Destructive, cancel, delete |
| `info` | `#3A8A8C` | Informational |

### Status (meeting cards)
| Token | Hex | Usage |
|-------|-----|-------|
| `status-open` | `#2D7D5F` | 모집중 |
| `status-closing` | `#D9802A` | 마감임박 |
| `status-full` | `#C4BAA8` | 마감 |
| `status-completed` | `#E4DDD1` | 종료 |
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
