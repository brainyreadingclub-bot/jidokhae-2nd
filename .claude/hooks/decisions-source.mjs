/**
 * 결정 기록(검토문서/DECISIONS.md)의 **최신판**을 찾는다 — 훅 공용.
 *
 * 왜 필요한가 (2026-10-13)
 *   결정 기록은 문서 작업 공간(`feat/agent-team`)에서만 갱신되고 `main`에는 8/21판이 남아 있었다.
 *   훅은 「세션을 연 폴더의 파일」을 읽으므로, `main`에서 갈라진 코드 작업용 폴더(worktree)에서
 *   연 세션은 **결정 30개가 빠진 옛 판**으로 시작했다. 이미 정한 일을 다시 묻는 사고가 그 판에서 난다.
 *
 * 찾는 순서 — 앞에서 찾으면 멈춘다
 *   1. 저장소 본 폴더가 `feat/agent-team`에 있으면 **그 폴더의 파일** (저장 전 수정까지 포함 — 가장 새롭다)
 *   2. 로컬 가지 `feat/agent-team`에 저장된 판 (`git show`) — 모든 worktree가 같은 가지를 본다
 *   3. 온라인 저장소 쪽 `origin/feat/agent-team`에 저장된 판
 *   4. 세션을 연 폴더의 파일 (예전과 같은 동작 — 위가 전부 실패했을 때만)
 *
 * 어느 것도 throw하지 않는다. 훅이 세션을 막으면 안 된다.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

export const DOC_BRANCH = 'feat/agent-team'
export const DECISIONS_PATH = '검토문서/DECISIONS.md'

export function git(cwd, args) {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
      maxBuffer: 16 * 1024 * 1024,
    })
  } catch {
    return null
  }
}

/** 저장소 본 폴더(main checkout) 경로. worktree 안에서도 같은 곳을 가리킨다 */
export function mainCheckoutDir(cwd) {
  const common = git(cwd, ['rev-parse', '--path-format=absolute', '--git-common-dir'])
  return common ? dirname(resolve(common.trim())) : null
}

/** 본 폴더가 문서 작업 공간 가지에 있으면 그 경로, 아니면 null */
export function docCheckoutDir(cwd) {
  const main = mainCheckoutDir(cwd)
  if (!main) return null
  const branch = git(main, ['branch', '--show-current'])
  return branch && branch.trim() === DOC_BRANCH ? main : null
}

/**
 * @returns {{ body: string, source: 'doc-checkout' | 'doc-branch' | 'doc-remote' | 'local-file' } | null}
 */
export function readLatestDecisions(root) {
  const docDir = docCheckoutDir(root)
  if (docDir) {
    try {
      return { body: readFileSync(join(docDir, DECISIONS_PATH), 'utf8'), source: 'doc-checkout' }
    } catch {}
  }
  for (const [ref, source] of [[DOC_BRANCH, 'doc-branch'], [`origin/${DOC_BRANCH}`, 'doc-remote']]) {
    const body = git(root, ['show', `${ref}:${DECISIONS_PATH}`])
    if (body) return { body, source }
  }
  try {
    return { body: readFileSync(join(root, DECISIONS_PATH), 'utf8'), source: 'local-file' }
  } catch {
    return null
  }
}

/** 결정 기록이 마지막으로 바뀐 시각(초). 저장된 판과 본 폴더의 저장 전 수정 중 가장 늦은 것 */
export function decisionsLastChanged(root) {
  const times = []
  for (const ref of [DOC_BRANCH, `origin/${DOC_BRANCH}`]) {
    const t = git(root, ['log', '-1', '--format=%ct', ref, '--', DECISIONS_PATH])
    if (t && t.trim()) times.push(Number(t.trim()))
  }
  const docDir = docCheckoutDir(root)
  if (docDir) {
    try {
      times.push(Math.floor(statSync(join(docDir, DECISIONS_PATH)).mtimeMs / 1000))
    } catch {}
  }
  return times.length ? Math.max(...times) : null
}
