import type { CSSProperties } from 'react'

/**
 * 결제·취소 버튼(MeetingActionButton)의 **겉 스타일만** 갈아 끼우는 토큰 맵.
 *
 * 왜 이렇게 하나 — 회원 화면이 두 벌(구 잉크그린 / `(next)` 토스)인데,
 * 돈이 움직이는 981줄 컴포넌트를 복사하면 결제·환불 로직이 두 벌이 된다.
 * 다음에 환불 규칙이 바뀌면 한쪽만 고쳐진다 (PR #64가 고친 사고의 모양).
 * 그래서 **로직은 한 벌로 두고 클래스 문자열만 이 표에서 고른다.**
 *
 * ⚠️ Tailwind v4 `@theme inline`은 유틸리티에 색을 **리터럴로 박아** 컴파일한다
 * (`.bg-primary-600 { background-color: #0d5c43 }`). 그래서 CSS 변수를 덮어써도
 * `bg-primary-*` 같은 클래스는 안 바뀐다 — 프롭으로 문자열을 고르는 이 방식이 필요했다.
 * 2026-08-25 `@tailwindcss/cli` 출력으로 직접 확인.
 *
 * `legacy` 값은 기존 코드에서 **그대로 옮긴 문자열**이다. 구 화면은 픽셀이 바뀌지 않는다.
 */

export type SkinName = 'legacy' | 'toss'

export type ActionSkin = {
  /** sticky 하단 바 — 하단 내비 높이만큼 띄운다 (구 2탭 64px / 새 5탭 56px) */
  stickyOuterStyle: CSSProperties
  stickyInnerStyle: CSSProperties
  btnPrimary: string
  btnPrimaryStyle?: CSSProperties
  btnWaitlist: string
  btnWaitlistStyle?: CSSProperties
  btnDisabled: string
  btnGhost: string
  btnGhostStyle?: CSSProperties
  note: string
  /** 완료 패널 */
  panel: string
  panelStyle?: CSSProperties
  panelIcon: string
  panelIconSvg: string
  panelTitle: string
  panelBody: string
  panelStrong: string
  panelSmall: string
  panelCta: string
  /** 대기 안내 카드 */
  waitCard: string
  waitCardStyle?: CSSProperties
  waitPill: string
  waitAmount: string
  waitBody: string
  attended: string
  attendedStyle?: CSSProperties
  /** 모달 */
  modalTitle: string
  modalBody: string
  modalMuted: string
  infoBox: string
  infoBoxStyle?: CSSProperties
  infoLabel: string
  infoValue: string
  infoDividerStyle: CSSProperties
  infoTotalLabel: string
  infoTotalValue: string
  ruleText: string
  warnText: string
  supportBox: string
  supportBoxStyle?: CSSProperties
  supportText: string
  btnSecondary: string
  btnSecondaryStyle?: CSSProperties
  btnConfirm: string
  btnDanger: string
  processingText: string
  /** 스텝 할인 영수증 */
  receipt: string
  receiptStyle?: CSSProperties
  receiptStruck: string
  receiptDiscountLabel: string
  receiptDiscountValue: string
  receiptDividerStyle: CSSProperties
  receiptTotalLabel: string
  receiptTotalValue: string
  /** 결제 수단 카드 */
  optionCard: string
  optionCardStyle?: CSSProperties
  optionIcon: string
  optionTitle: string
  optionSub: string
  optionCardOff: string
  optionCardOffStyle?: CSSProperties
  optionIconOff: string
  optionTitleOff: string
  optionSubOff: string
  backBtn: string
  transferTitle: string
  transferAmount: string
  toastStyle: CSSProperties
}

const legacy: ActionSkin = {
  stickyOuterStyle: { paddingBottom: 'calc(64px + env(safe-area-inset-bottom, 0px))' },
  stickyInnerStyle: {
    backgroundColor: 'var(--color-surface-50)',
    boxShadow: '0 -2px 8px rgba(45, 90, 61, 0.06)',
  },
  btnPrimary:
    'w-full rounded-[var(--radius-lg)] bg-primary-600 py-4 text-sm font-bold text-white tracking-wide transition-all hover:bg-primary-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed',
  btnPrimaryStyle: { boxShadow: '0 4px 14px rgba(27, 67, 50, 0.25)' },
  btnWaitlist:
    'w-full rounded-[var(--radius-lg)] bg-accent-500 py-4 text-sm font-bold text-white tracking-wide transition-all hover:bg-accent-600 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed',
  btnWaitlistStyle: { boxShadow: '0 4px 14px rgba(180, 100, 60, 0.25)' },
  btnDisabled:
    'w-full rounded-[var(--radius-lg)] bg-neutral-100 py-4 text-sm font-bold text-neutral-400 cursor-not-allowed',
  btnGhost:
    'w-full rounded-[var(--radius-lg)] bg-white py-4 text-sm font-bold text-neutral-700 transition-all hover:bg-neutral-50 active:scale-[0.98]',
  btnGhostStyle: { border: '1px solid var(--color-neutral-300)' },
  note: 'mt-2 text-center text-xs text-primary-400 leading-relaxed',
  panel: 'mt-8 rounded-[var(--radius-lg)] p-6 text-center',
  panelStyle: {
    backgroundColor: 'var(--color-surface-50)',
    border: '1px solid var(--color-surface-300)',
  },
  panelIcon: 'mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-50',
  panelIconSvg: 'text-primary-600',
  panelTitle: 'text-base font-bold text-primary-900',
  panelBody: 'mt-2 text-sm text-primary-600/70',
  panelStrong: 'font-bold text-primary-800',
  panelSmall: 'text-xs text-primary-400',
  panelCta:
    'mt-4 w-full rounded-[var(--radius-lg)] bg-primary-600 py-3.5 text-sm font-bold text-white transition-all hover:bg-primary-700 active:scale-[0.98]',
  waitCard: 'mt-8 rounded-[var(--radius-lg)] p-5',
  waitCardStyle: {
    backgroundColor: 'var(--color-surface-50)',
    border: '1px solid var(--color-accent-200)',
  },
  waitPill:
    'inline-flex items-center rounded-full bg-accent-50 px-2.5 py-0.5 text-[11px] font-bold text-accent-700 border border-accent-200',
  waitAmount: 'text-sm font-bold text-primary-800',
  waitBody: 'text-xs text-primary-500 leading-relaxed',
  attended:
    'mt-8 w-full rounded-[var(--radius-lg)] bg-primary-50 py-4 text-center text-sm font-bold text-primary-700',
  attendedStyle: { border: '1px solid var(--color-primary-100)' },
  modalTitle: 'text-base font-bold text-primary-900',
  modalBody: 'mt-3 text-sm text-primary-600/70',
  modalMuted: 'text-primary-400',
  infoBox: 'mt-4 rounded-[var(--radius-md)] p-4',
  infoBoxStyle: {
    backgroundColor: 'var(--color-surface-100)',
    border: '1px solid var(--color-surface-300)',
  },
  infoLabel: 'text-primary-500',
  infoValue: 'font-semibold text-primary-800',
  infoDividerStyle: { borderTop: '1px solid var(--color-surface-300)' },
  infoTotalLabel: 'font-semibold text-primary-700',
  infoTotalValue: 'font-bold text-accent-600',
  ruleText: 'mt-4 text-xs text-primary-400 text-center',
  /** 여백(mt-*)은 호출부가 붙인다 — 모달마다 다르다 */
  warnText: 'text-xs text-warning text-center font-medium',
  supportBox: 'mt-3 rounded-[var(--radius-md)] p-3 text-center',
  supportBoxStyle: {
    backgroundColor: 'var(--color-accent-50)',
    border: '1px solid var(--color-accent-200)',
  },
  supportText: 'text-xs text-accent-700 leading-relaxed',
  btnSecondary:
    'flex-1 rounded-[var(--radius-md)] py-2.5 text-sm font-medium transition-colors hover:bg-primary-50',
  btnSecondaryStyle: {
    backgroundColor: 'var(--color-surface-50)',
    border: '1px solid var(--color-surface-300)',
    color: 'var(--color-primary-600)',
  },
  btnConfirm:
    'flex-1 rounded-[var(--radius-md)] bg-primary-700 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-800',
  btnDanger:
    'flex-1 rounded-[var(--radius-md)] bg-error py-2.5 text-sm font-bold text-white transition-colors hover:bg-error/90',
  processingText: 'mt-3 text-sm text-primary-500',
  /** 여백·최대폭은 호출부가 붙인다 (결제수단 모달 280px / 이체 모달 260px) */
  receipt: 'mx-auto text-left rounded-[var(--radius-md)] bg-surface-50 px-4 py-3',
  receiptStyle: { border: '1px solid var(--color-surface-300)' },
  receiptStruck: 'text-[12px] text-neutral-400',
  receiptDiscountLabel: 'text-primary-700 font-semibold',
  receiptDiscountValue: 'text-primary-600 font-semibold',
  receiptDividerStyle: { borderTop: '1px dashed var(--color-surface-300)' },
  receiptTotalLabel: 'text-[13px] font-bold text-neutral-800',
  receiptTotalValue: 'text-lg font-extrabold text-primary-500',
  optionCard:
    'w-full rounded-[var(--radius-lg)] p-4 text-left transition-all hover:bg-primary-100 active:scale-[0.98]',
  optionCardStyle: {
    backgroundColor: 'var(--color-primary-50)',
    border: '1px solid var(--color-primary-200)',
  },
  optionIcon: 'text-primary-600',
  optionTitle: 'text-sm font-semibold text-primary-800',
  optionSub: 'text-xs text-primary-500 mt-0.5',
  optionCardOff: 'rounded-[var(--radius-lg)] p-4 opacity-50 cursor-not-allowed',
  optionCardOffStyle: {
    backgroundColor: 'var(--color-surface-100)',
    border: '1px solid var(--color-surface-300)',
  },
  optionIconOff: 'text-primary-400',
  optionTitleOff: 'text-sm font-semibold text-primary-700',
  optionSubOff: 'text-xs text-primary-400 mt-0.5',
  backBtn:
    'inline-flex items-center gap-1 text-sm text-primary-500 hover:text-primary-700 transition-colors mb-4',
  transferTitle: 'text-sm font-bold text-primary-900',
  transferAmount: 'text-lg font-bold text-neutral-900 mt-1',
  toastStyle: {
    backgroundColor: 'var(--color-primary-800)',
    boxShadow: 'var(--shadow-elevated)',
  },
}

/**
 * 토스 스킨 — 테두리 0(구분은 회색 면), radius 14–20, 14px 미만 보조 텍스트는 tg-600 이상.
 * 전면개편 설계서 §3 · §10.
 */
const toss: ActionSkin = {
  stickyOuterStyle: { paddingBottom: 'calc(56px + env(safe-area-inset-bottom, 0px))' },
  stickyInnerStyle: {
    backgroundColor: '#FFFFFF',
    boxShadow: '0 -2px 10px rgba(25, 31, 40, 0.06)',
  },
  btnPrimary:
    'w-full rounded-[14px] bg-brand py-4 text-[15px] font-bold tracking-tight text-white transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed',
  btnWaitlist:
    'w-full rounded-[14px] bg-warnx py-4 text-[15px] font-bold tracking-tight text-white transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed',
  btnDisabled:
    'w-full rounded-[14px] bg-tg-100 py-4 text-[15px] font-bold text-tg-500 cursor-not-allowed',
  btnGhost:
    'w-full rounded-[14px] bg-tg-100 py-4 text-[15px] font-bold text-tg-700 transition-all active:scale-[0.98]',
  note: 'mt-2 text-center text-xs text-tg-600 leading-relaxed',
  panel: 'mt-8 rounded-[20px] bg-white p-6 text-center',
  panelStyle: { boxShadow: 'var(--shadow-toss-card)' },
  panelIcon: 'mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-bg',
  panelIconSvg: 'text-brand',
  panelTitle: 'text-base font-bold text-tg-900',
  panelBody: 'mt-2 text-sm text-tg-700',
  panelStrong: 'font-bold text-tg-900',
  panelSmall: 'text-xs text-tg-600',
  panelCta:
    'mt-4 w-full rounded-[14px] bg-brand py-3.5 text-[15px] font-bold text-white transition-all active:scale-[0.98]',
  waitCard: 'mt-8 rounded-[18px] bg-tg-100 p-5',
  waitPill:
    'inline-flex items-center rounded-full bg-warnx-bg px-2.5 py-0.5 text-[11px] font-bold text-warnx',
  waitAmount: 'text-sm font-bold text-tg-900',
  waitBody: 'text-xs text-tg-600 leading-relaxed',
  attended:
    'mt-8 w-full rounded-[14px] bg-brand-bg py-4 text-center text-[15px] font-bold text-brand-deep',
  modalTitle: 'text-base font-bold text-tg-900',
  modalBody: 'mt-3 text-sm text-tg-700',
  modalMuted: 'text-tg-600',
  infoBox: 'mt-4 rounded-[14px] bg-tg-100 p-4',
  infoLabel: 'text-tg-600',
  infoValue: 'font-bold text-tg-900',
  infoDividerStyle: { borderTop: '1px solid var(--color-tg-200)' },
  infoTotalLabel: 'font-bold text-tg-800',
  infoTotalValue: 'font-extrabold text-warnx',
  ruleText: 'mt-4 text-xs text-tg-600 text-center',
  warnText: 'text-xs text-warnx text-center font-bold',
  supportBox: 'mt-3 rounded-[14px] bg-warnx-bg p-3 text-center',
  supportText: 'text-xs text-tg-800 leading-relaxed',
  btnSecondary:
    'flex-1 rounded-[12px] bg-tg-100 py-2.5 text-sm font-bold text-tg-700 transition-colors',
  btnConfirm:
    'flex-1 rounded-[12px] bg-brand py-2.5 text-sm font-bold text-white transition-colors',
  btnDanger:
    'flex-1 rounded-[12px] bg-warnx py-2.5 text-sm font-bold text-white transition-colors',
  processingText: 'mt-3 text-sm text-tg-600',
  receipt: 'mx-auto text-left rounded-[14px] bg-tg-100 px-4 py-3',
  receiptStruck: 'text-[12px] text-tg-600',
  receiptDiscountLabel: 'text-brand-deep font-bold',
  receiptDiscountValue: 'text-brand-deep font-bold',
  receiptDividerStyle: { borderTop: '1px dashed var(--color-tg-300)' },
  receiptTotalLabel: 'text-[13px] font-bold text-tg-900',
  receiptTotalValue: 'text-lg font-extrabold text-brand-deep',
  optionCard: 'w-full rounded-[16px] bg-tg-100 p-4 text-left transition-all active:scale-[0.98]',
  optionIcon: 'text-brand',
  optionTitle: 'text-sm font-bold text-tg-900',
  optionSub: 'text-xs text-tg-600 mt-0.5',
  optionCardOff: 'rounded-[16px] bg-tg-50 p-4 opacity-70 cursor-not-allowed',
  optionIconOff: 'text-tg-400',
  optionTitleOff: 'text-sm font-bold text-tg-700',
  optionSubOff: 'text-xs text-tg-600 mt-0.5',
  backBtn: 'inline-flex items-center gap-1 text-sm font-semibold text-tg-600 transition-colors mb-4',
  transferTitle: 'text-sm font-bold text-tg-900',
  transferAmount: 'text-lg font-extrabold text-tg-900 mt-1',
  toastStyle: {
    backgroundColor: 'var(--color-tg-900)',
    boxShadow: '0 8px 24px rgba(25, 31, 40, 0.24)',
  },
}

export function getActionSkin(skin: SkinName = 'legacy'): ActionSkin {
  return skin === 'toss' ? toss : legacy
}
