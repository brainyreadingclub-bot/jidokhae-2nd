import { VALID_REGIONS } from '@/lib/regions'

export type ProfileUpdateInput = {
  nickname?: string
  phone?: string
  region?: string[]
  email?: string | null
}

export type CurrentProfile = {
  nickname: string
  nickname_changed_at: string | null
}

export type ResolveResult =
  | { ok: false; message: string }
  | { ok: true; updates: Record<string, unknown>; nicknameChanged: boolean }

export function resolveProfileUpdate(
  input: ProfileUpdateInput,
  current: CurrentProfile,
  opts: { hasPendingTransfer: boolean },
): ResolveResult {
  const updates: Record<string, unknown> = {}

  if (input.phone !== undefined) {
    const digits = input.phone.replace(/\D/g, '')
    if (!/^010\d{7,8}$/.test(digits)) {
      return { ok: false, message: '010으로 시작하는 휴대폰 번호를 입력해주세요' }
    }
    updates.phone = digits
  }

  if (input.region !== undefined) {
    if (
      !Array.isArray(input.region) ||
      input.region.length === 0 ||
      !input.region.every((r) => (VALID_REGIONS as readonly string[]).includes(r))
    ) {
      return { ok: false, message: '지역을 하나 이상 선택해주세요' }
    }
    updates.region = input.region
  }

  if (input.email !== undefined) {
    const email = (input.email ?? '').trim() || null
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false, message: '올바른 이메일을 입력해주세요' }
    }
    updates.email = email
  }

  let nicknameChanged = false
  if (input.nickname !== undefined) {
    const trimmed = input.nickname.trim()
    // 현재 닉네임과 실제로 다를 때만 변경으로 취급 → 1회 기회 보호
    if (trimmed !== current.nickname) {
      if (trimmed.length < 2 || trimmed.length > 20) {
        return { ok: false, message: '닉네임은 2~20자로 입력해주세요' }
      }
      if (current.nickname_changed_at !== null) {
        return { ok: false, message: '닉네임은 1회만 변경할 수 있어요' }
      }
      if (opts.hasPendingTransfer) {
        return { ok: false, message: '입금 확인이 끝난 뒤 닉네임을 변경할 수 있어요' }
      }
      updates.nickname = trimmed
      nicknameChanged = true
    }
  }

  return { ok: true, updates, nicknameChanged }
}
