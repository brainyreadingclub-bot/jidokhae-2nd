/**
 * 자리 상태 공통 규칙 — 모임 카드·상세·홈 칸이 **이 함수 한 벌**로 자리 문구를 정한다 (2026-10-16, 보관함 I-002).
 *
 * 규칙 (위에서부터 먼저 맞는 것 하나)
 * 1. 정원이 찼다 → 지금 그대로 `N/N명` (마감 문구는 이번에 바꾸지 않는다)
 * 2. 신청자 3명 미만 가리기(`shouldMaskConfirmedCount`)에 걸린다 → `N명 모집 중`
 *    — 「1자리 남았어요」가 정원 3·4 모임에서 인원을 거꾸로 알려 주는 것도 이 줄이 막는다
 * 3. 남은 자리 ≤ 정원 × 20%(올림) → `n자리 남았어요`
 * 4. 신청 인원 ≥ 정원 × 1/3(올림) → `n명이 함께해요`
 * 5. 그 밖 → 운영진·이미 신청한 본인은 `n/N명`, 나머지는 `N명 모집 중`
 *
 * 🔴 빨간색·「마감 임박」 같은 말을 쓰지 않는다. 강조가 필요하면 `tone: 'emphasis'`(중립 진한 회색 굵게) 하나뿐이다.
 * 기준 비율은 `site_settings`의 `seat_left_ratio`·`seat_together_ratio`에서 읽고, 없거나 이상하면 아래 기본값.
 * 문구는 `docs/문구표준.md` §2.
 */

import { shouldMaskConfirmedCount } from '@/lib/visibility'

/** 남은 자리가 정원의 이 비율(올림) 이하면 「n자리 남았어요」 */
export const DEFAULT_SEAT_LEFT_RATIO = 0.2
/** 신청 인원이 정원의 이 비율(올림) 이상이면 「n명이 함께해요」 */
export const DEFAULT_SEAT_TOGETHER_RATIO = 1 / 3

export const SEAT_LEFT_RATIO_KEY = 'seat_left_ratio'
export const SEAT_TOGETHER_RATIO_KEY = 'seat_together_ratio'

export type SeatThresholds = { leftRatio: number; togetherRatio: number }

export const DEFAULT_SEAT_THRESHOLDS: SeatThresholds = {
  leftRatio: DEFAULT_SEAT_LEFT_RATIO,
  togetherRatio: DEFAULT_SEAT_TOGETHER_RATIO,
}

function parseRatio(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback
  const n = Number(raw.trim())
  return raw.trim() !== '' && Number.isFinite(n) && n > 0 && n <= 1 ? n : fallback
}

/** `site_settings` 값 → 기준 비율 (순수 함수). 키가 없거나 0 이하·1 초과·숫자 아님이면 기본값 */
export function resolveSeatThresholds(settings: Record<string, string> | null | undefined): SeatThresholds {
  return {
    leftRatio: parseRatio(settings?.[SEAT_LEFT_RATIO_KEY], DEFAULT_SEAT_LEFT_RATIO),
    togetherRatio: parseRatio(settings?.[SEAT_TOGETHER_RATIO_KEY], DEFAULT_SEAT_TOGETHER_RATIO),
  }
}

/**
 * 정원 × 비율을 올림. `25 * 0.28`이 `7.000000000000001`이라 그냥 올리면 8이 된다(설정값을 바꿨을 때) — 아주 작은 값을 빼고 올린다
 */
export function ceilShare(capacity: number, ratio: number): number {
  return Math.ceil(capacity * ratio - 1e-9)
}

export type SeatStatusKind = 'full' | 'recruiting' | 'seats_left' | 'together' | 'exact'

export type SeatStatus = {
  kind: SeatStatusKind
  /** 화면에 그대로 쓰는 문구 */
  label: string
  /** `emphasis` = 진한 회색 굵게(남은 자리), `normal` = 기본 글자색. 빨강·주황은 없다 */
  tone: 'normal' | 'emphasis'
  /** `seats_left`일 때 남은 자리 수, 아니면 null */
  seatsLeft: number | null
}

export function getSeatStatus(input: {
  capacity: number
  /** 정원을 차지한 인원 (confirmed + pending_transfer — `get_confirmed_counts`) */
  confirmed: number
  /** 운영진 또는 이 모임에 자리를 잡은 본인 — 가리기를 덜 하고 마지막 칸에서 정확한 수를 본다 */
  isPrivileged: boolean
  thresholds?: SeatThresholds
}): SeatStatus {
  const { capacity, confirmed, isPrivileged } = input
  const t = input.thresholds ?? DEFAULT_SEAT_THRESHOLDS

  if (confirmed >= capacity) {
    return { kind: 'full', label: `${confirmed}/${capacity}명`, tone: 'normal', seatsLeft: null }
  }
  if (shouldMaskConfirmedCount(confirmed, capacity, isPrivileged)) {
    return { kind: 'recruiting', label: `${capacity}명 모집 중`, tone: 'normal', seatsLeft: null }
  }
  const left = capacity - confirmed
  if (left <= ceilShare(capacity, t.leftRatio)) {
    return { kind: 'seats_left', label: `${left}자리 남았어요`, tone: 'emphasis', seatsLeft: left }
  }
  if (confirmed >= ceilShare(capacity, t.togetherRatio)) {
    return { kind: 'together', label: `${confirmed}명이 함께해요`, tone: 'normal', seatsLeft: null }
  }
  return isPrivileged
    ? { kind: 'exact', label: `${confirmed}/${capacity}명`, tone: 'normal', seatsLeft: null }
    : { kind: 'recruiting', label: `${capacity}명 모집 중`, tone: 'normal', seatsLeft: null }
}

/**
 * 모임 상세 「참여」 칸 문구 — 모임 종류에 따라 갈린다.
 * - 정기모임: `getSeatStatus` (이 파일의 공통 규칙)
 * - 토론모임: **이번엔 손대지 않는다** — 지금 그대로(3명 미만 가리기 + `n/N명`).
 *   토론모임은 「평소 인원을 숨기고 마감일 때만 보인다」(DECISIONS 2026-08-14, 🔨 미적용)가 따로 있어,
 *   공통 규칙의 「n명이 함께해요」를 그대로 쓰면 그 결정과 정면으로 부딪친다. 정할 때까지 옛 동작을 지킨다
 */
export function getDetailSeatLabel(input: {
  meetingType: string | null | undefined
  capacity: number
  confirmed: number
  isPrivileged: boolean
  thresholds?: SeatThresholds
}): string {
  const { meetingType, capacity, confirmed, isPrivileged } = input
  if (meetingType === 'discussion') {
    return shouldMaskConfirmedCount(confirmed, capacity, isPrivileged)
      ? `${capacity}명 모집 중`
      : `${confirmed}/${capacity}명`
  }
  return getSeatStatus({ capacity, confirmed, isPrivileged, thresholds: input.thresholds }).label
}
