export type BookAsk = {
  id: string
  user_id: string
  meeting_id: string
  status: 'viewed' | 'answered' | 'dismissed'
  first_viewed_at: string | null
  dismissed_at: string | null
  created_at: string
}

// strip에 띄울 미해소 정기모임 1건
export type PendingAsk = {
  meetingId: string
  meetingDate: string // "YYYY-MM-DD"
}

// admin 미니 카운트.
// 핵심 규칙: 분자(answered/dismissed/viewed)는 반드시 분모(자격 참여)와 동일 모집단에서만 집계한다.
// 과거 버그: 분자를 book_asks 전량에서 세어 60일 윈도우 밖·비자격 건이 섞여 응답률이 100%를 넘었다.
export type AskStats = {
  denominator: number    // 자격 참여 건 (최근 60일 정기, user·meeting dedup) = 노출 가능 모수(분모)
  exposed: number        // 실제 물어보기가 뜬 건 (answered+dismissed+viewed, 자격 교집합)
  answered: number       // 담음
  dismissed: number      // 닫음
  viewed: number         // 노출됐지만 미응답
  unexposed: number      // 자격 있으나 아직 안 뜬 건 (denominator - exposed, clamp)
  exposureRate: number   // 노출률 = exposed / denominator (분모 0이면 0)
  conversionRate: number // 전환율(북극성) = answered / exposed (노출 0이면 0)
}
