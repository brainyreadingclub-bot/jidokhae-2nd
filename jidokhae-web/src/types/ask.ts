export type BookAsk = {
  id: string
  user_id: string
  meeting_id: string
  status: 'answered' | 'dismissed'
  created_at: string
}

// strip에 띄울 미해소 정기모임 1건
export type PendingAsk = {
  meetingId: string
  meetingDate: string // "YYYY-MM-DD"
}

// admin 미니 카운트
export type AskStats = {
  denominator: number // 정기 참여 건 (최근 윈도우, 분모)
  answered: number    // 담음
  dismissed: number   // 닫음
  pending: number     // 미응답(분모 - 담음 - 닫음, 음수 방지 clamp)
  responseRate: number // 담음 / 분모 (분모 0이면 0)
}
