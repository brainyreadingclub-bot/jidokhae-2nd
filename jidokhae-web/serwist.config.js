// @ts-check
import { spawnSync } from 'node:child_process'
import { serwist } from '@serwist/next/config'

// git revision으로 precache versioning. CI에서 git 없으면 random UUID fallback.
const revision =
  spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf-8' }).stdout?.trim() ||
  crypto.randomUUID()

export default serwist({
  swSrc: 'src/sw.ts',
  swDest: 'public/sw.js',
  // 추가 precache 엔트리 (Next.js 자동 감지에 누락된 경로 보강)
  additionalPrecacheEntries: [{ url: '/', revision }],
})
