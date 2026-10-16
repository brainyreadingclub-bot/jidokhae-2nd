/**
 * 표정 그림 — 인라인 SVG (이모지 아님). 기기마다 이모지 얼굴이 달라 「아쉬움」의 세기가 달라 보인다
 * (시안 README). 고른 것은 그린 면, 나머지는 회색 면.
 */
const MOUTHS: Record<number, string> = {
  1: 'M16 35 Q26 26 36 35',
  2: 'M17 34 Q26 29.5 35 34',
  3: 'M17.5 32 H34.5',
  4: 'M17 29.5 Q26 37 35 29.5',
  5: 'M15.5 28.5 Q26 42 36.5 28.5 Z',
}

export default function MoodFace({ value, on }: { value: number; on: boolean }) {
  const bg = on ? '#0FA873' : '#F2F4F6'
  const fg = on ? '#FFFFFF' : '#8B95A1'
  const filled = value === 5
  return (
    <svg viewBox="0 0 52 52" width="52" height="52" aria-hidden className="block">
      <circle cx="26" cy="26" r="26" fill={bg} />
      <circle cx="19" cy="21" r="2.6" fill={fg} />
      <circle cx="33" cy="21" r="2.6" fill={fg} />
      <path
        d={MOUTHS[value]}
        fill={filled ? fg : 'none'}
        stroke={fg}
        strokeWidth={filled ? 2.4 : 2.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
