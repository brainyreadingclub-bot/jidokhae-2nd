/**
 * 진단 로그 헬퍼 — 2026-05-19 Supabase cold-start 인시던트 후 도입.
 *
 * 목적: Server Component / Route Handler 안에서 각 외부 호출(DB, auth, RPC) 전후
 * timing 로그를 찍어 hang 지점을 식별. Vercel Runtime Logs에서 `[prefix:reqId]`로
 * 한 요청의 전체 흐름을 추적 가능.
 *
 * 왜 헬퍼인가:
 * - React Server Component는 순수 함수여야 한다는 react-hooks/purity 룰 적용.
 * - `Math.random()`, `Date.now()`는 impure → SC 안에서 직접 호출 시 lint 에러.
 * - impure 호출을 헬퍼로 격리하면 SC 본문은 깨끗하게 유지 + lint 가드도 좁은 범위에만 disable.
 *
 * 임시성: 안정화 확인 후 (Vercel 로그에서 hang 패턴 없음 확인) 호출부와 함께 제거 예정.
 */

type Diagnostic = {
  /** 요청 식별자 (8자 무작위 영숫자). 한 요청의 모든 로그를 grep할 때 사용. */
  reqId: string
  /**
   * 단계 로그 출력.
   * @param name 단계 이름 (예: 'getSiteSettings start', 'meetings.select done in 92ms')
   * @param extra 추가 정보 (옵션. 예: rows 수, error 메시지)
   */
  stage: (name: string, extra?: string) => void
  /**
   * 시작 시점부터의 경과 ms. stage()의 timing 계산에 사용되며 외부에서도 호출 가능.
   */
  elapsed: () => number
}

/**
 * 진단 로그 컨텍스트 시작.
 *
 * 사용 예시:
 *   const diag = startDiagnostic('policy/meetings')
 *   diag.stage('start')
 *   const t = diag.elapsed()
 *   await someAsyncOp()
 *   diag.stage('someAsyncOp done', ` in ${diag.elapsed() - t}ms`)
 *
 * @param prefix 로그 경로 식별자 (예: 'callback', 'policy/meetings', 'home')
 * @returns Diagnostic 컨텍스트
 */
export function startDiagnostic(prefix: string): Diagnostic {
  // impure 호출(Math.random/Date.now)은 일반 함수 컨텍스트에 격리되어 있어
  // react-hooks/purity 룰의 영향을 받지 않음 (룰은 Server Component 본문에서만 트리거).
  const reqId = Math.random().toString(36).slice(2, 10)
  const t0 = Date.now()

  return {
    reqId,
    stage(name, extra = '') {
      const ms = Date.now() - t0
      console.log(`[${prefix}:${reqId}] ${name} (+${ms}ms)${extra}`)
    },
    elapsed() {
      return Date.now() - t0
    },
  }
}
