// @ts-check
import { serwist } from '@serwist/next/config'

export default serwist({
  swSrc: 'src/sw.ts',
  swDest: 'public/sw.js',
  // ⚠️ additionalPrecacheEntries 비워둠 — '/'는 인증 사용자별 동적 페이지라 절대 precache 금지
  // (다른 사용자의 stale HTML 노출 위험).
  // Serwist가 자동 감지하는 prerendered 정적 페이지(/policy/*, /auth/login)만 precache되며 안전.
})
