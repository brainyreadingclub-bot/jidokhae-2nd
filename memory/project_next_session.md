---
name: 다음 세션 핸드오프
description: 세션 간 연속성을 위한 현재 상태 + 다음 할 일 + 블로커 정리. 매 회고마다 덮어쓰기.
type: project
---

## 한 줄 요약 (2026-07-28 기준)

서재+물어보기 기능은 prod에 배포됐지만 **기능 플래그 OFF라 회원 노출 0**. "물어보기를 회원에게 어떻게 도달·노출할까"를 확정(→ 알림톡 주 진입점)하고, 켜기 전 블로킹이던 계측 버그를 수정해 배포했다. 남은 켜기 게이트는 (1) 알림톡 점검, (2) 회원 콜드스타트 화면 시안 합의.

## 현재 상태

**브랜치:** `main` (origin과 동기화). 최신 커밋 `1f9ffaa` (2026-07-24)
**prod 배포:** Vercel `dpl_FVucPkNEv1kA9CmxFZFjk7PXWWjn` — target=production, state=READY, sha=1f9ffaa (확인: 2026-07-28)

**최근 머지 이력:**
- `1f9ffaa` (7/24, PR #43 squash) — fix(library): 물어보기 응답률 계측 버그 수정 + 지표 재정의
- `dcc61d5` (7/15, PR #42 머지커밋) — 토론모임 1조각: 서재 + 물어보기 (플래그 OFF 배포)
- `9569f3f` (7/12, PR #41) — 토론모임 0조각: `meeting_type` 정기/토론 구분
- `efce2e2` (7/10, PR #39) — 2535 잉크그린 × 에디토리얼 전면 리디자인

## 배경 맥락 (왜 이걸 하고 있나)

**물어보기(책 담기)** = 정기모임 참여자에게 "그 모임에서 무슨 책 읽으셨어요?"를 물어 서재에 담게 하는 무료 인게이지먼트 기능. **북극성 지표 = 전환율(담음 ÷ 노출)**.

처음엔 홈 카드 / 토스트 / 종(알림 점) 같은 인앱 UI로 유도하려 시안을 여럿 만들었으나, 전문가 패널 5명이 방향을 뒤집음 (`docs/expert-panel/2026-07-16-ask-entry-alimtalk-pivot.md`):

> 회원은 모임 사이에 앱을 잘 안 켠다 → 인앱 UI는 응답률 천장이 구조적으로 낮다. 진짜 도달 수단은 이미 돌아가는 카카오 알림톡. **모임 다음날 "무슨 책 읽으셨어요?" 알림톡 + 딥링크가 주 진입점**, 인앱은 조용한 인라인 스트립(안전망)만. **토스트·종은 제외** — 4050 비IT 회원이 검은 토스트=광고/에러, 종=미지의 UI로 읽음.

그런데 플래그를 켜기 전에 응답률 계측 자체가 틀려 있던 걸 발견 → baseline 오염을 막으려 그것부터 수정.

## 이번에 완료한 것 (배포됨, 회원 노출 0)

**계측 버그 수정** — `getAskStats`가 분자(담음/닫음/노출)를 `book_asks` 전량에서 세고 분모(자격 참여)는 60일 윈도우+자격 필터라 **서로 다른 모집단** → 응답률 100% 초과 가능했음. 분자를 분모와 교집합해 동일 모집단으로 고정하고, 계산을 순수 함수 `computeAskStats`(`src/lib/asks-pure.ts`)로 분리.

**지표 재정의** — 노출률(노출 ÷ 자격참여) + 전환율(담음 ÷ 실제노출, 북극성) 2지표 분리. 관리자 폐기선을 "4주 30%" → **"노출 누적 30건 이상에서 판단, 그 전엔 '유보' 표시"** 로 교체 (`admin/library/page.tsx`의 `RELIABLE_EXPOSED = 30`).

**회귀 테스트** `src/lib/__tests__/asks-pure.test.ts` (100% 초과 방지 포함). **검색 문구 완화**(`BookSearchInput` 부분검색 힌트 + 0건 폴백)도 동봉. prelaunch 통과.

**인앱 진입점은 손댈 것 없음** — 이미 조용한 스트립 2곳(`AskStripSection` 홈, `MeetingAskStripSection` 모임 상세)뿐. 종 컴포넌트는 존재하지 않고, `LibraryToast`는 "담기/빼기 → 6.5초 실행취소" 피드백용일 뿐 진입점이 아님.

## 다음 할 일 (우선순위 순)

1. **[단무지님 몫 · 현재 보류]** 현재 알림톡 5종 실작동 점검 — 도달·심사·발송 로그 확인. "따로 점검하고 나중에 도입"으로 순서 확정됨. 정상 확인 후에야 2번 착수.
2. **알림톡 6번째 템플릿**(모임 다음날 오전 cron) — confirmed 참여자에게 1회, answered/dismissed는 dedup skip, 딥링크로 물어보기. 재사용 기반: `getPendingAsk`/`verifyEligibleParticipation`(`asks.ts`), 알림톡 5종 패턴(`notification.ts`·`solapi.ts`), `cron/meeting-remind`(KST 19:00) 구조. **1번 완료가 선행.**
3. **[켜기 전 게이트] 회원 콜드스타트 화면 시안 → 합의 → 검증** — 냅다 디자인 금지. 상태 전수(빈 서재/책 있음/물어보기 strip/소개 strip/겹침) → 흐름 서술 → HTML 목업 + 렌더 스크린샷 인라인 → 합의 → 구현 → 상태별 캡처. ⚠️ **일반 회원(빈 서재) 첫 노출 아직 미검증** (지금까지 등록 최다 계정으로만 확인).
4. 위 게이트 통과 → `site_settings.library_enabled='on'` 토글(배포 불필요) → 실제 전환율 측정 시작.

## 미결 / 주의

- **미커밋 문서 5건 대기** — `docs/expert-panel/2026-07-15-library-and-roadmap-review.md`, `docs/expert-panel/2026-07-16-ask-entry-alimtalk-pivot.md`, `docs/superpowers/mockups/` 3건(벤치마킹·홈카드-콜드스타트·토스트). 코드 PR을 깔끔히 하려 제외함 → 커밋 여부 미정.
- **스테일 브랜치 2개** — `feat/discussion-slice1`(PR #42 머지 완료), `fix/ask-stats-metric`(PR #43 머지 완료). 로컬·원격 모두 잔존. 삭제 여부 미확정.
- **문서 스테일** — 루트 `CLAUDE.md`와 `jidokhae-web/CLAUDE.md`에 서재·물어보기·`meeting_type` 아키텍처가 미반영(7/12 기준). 새 세션이 코드 구조를 CLAUDE.md만으로 파악하면 누락됨.
- **계측 해석** — 이제 전환율이 북극성. 노출 30건 미만이면 관리자 화면이 "유보" 표시 — 1~2건 요동을 판단으로 오인하지 말 것.
- **인프라** — prod Supabase `ycqqzzvyixvtdorjxkrn`(MCP는 dead project라 SQL 실행 금지). Vercel Preview는 prod Supabase 직결(카드 결제 테스트 금지). gh 활성 계정은 push 전 `brainyreadingclub-bot`인지 확인(2026-07-28 시점 이미 활성이나, 계정 3개 병존이라 매번 확인).
- **롤백** — `git revert 1f9ffaa`(계측만) / `git revert -m 1 dcc61d5`(1조각 전체, 코드만. 부모 2개 머지커밋 확인됨).

## 확정된 정책 / 의사결정 (반복 확인용)

다음 세션이 이 정책을 뒤집는 제안을 하지 않도록 **반드시 확인**:

### 물어보기 진입 방식 (2026-07-16 확정)
- **주 진입점 = 모임 다음날 알림톡 1발**. 인앱은 조용한 인라인 스트립(안전망)만
- **토스트·종을 주 진입점으로 만들지 말 것** (4050 비IT 회원 인지 실패)
- 알림톡 발송 자체가 운영 정책 사안(이 서비스는 알림 피로에 민감) → **도입은 단무지님 결정**
- 미합의: 알림톡 톤(정보성 vs 혜택) — 카카오 심사 분류 리스크

### 역할 권한 매트릭스 (2026-04-23 확정)
- `admin`(총괄): 전체 (정산, 회원 개인정보, 사이트 설정, 배너, 한줄)
- `editor`(운영진): 모임 CRUD, 회원 조회(개인정보 제외), **배너 + 한줄**
- `member`(회원): 일반 기능
- adminOnly: 정산, 회원 개인정보(phone/email), 사이트 설정

### 법적 확인 완료 (2026-04-23)
- 간이과세자 → **통신판매업 신고 면제** (전자상거래법 시행령 §12 제1항 2호)
- GA4 동의 배너 **불필요** (현 규모, privacy 문구로 갈음) / 변호사 자문 **불필요**

### 운영 정책
- **계좌이체 입금 확인 시 회원 알림톡 발송 금지**: 월말 일괄 처리 때문. 카드결제만 즉시 알림 유지
- **"입금 완료" 버튼 카피 유지**: 실제 플로우상 과거형이 정확

### 워크플로우 규칙
- **UI 작업 전 `/frontend-design` 스킬 선행 필수**
- **(main) 라우트 검증은 Vercel Preview에서만** (로컬 OAuth 콜백 불가)
- **prod schema 의존 SQL 작성 시 grep 선행**

## 이월된 옛 항목 (M7 Step 3 계열, 서재 작업에 밀림)

- API 인증 헬퍼 `requireUser`/`requireAdmin` 추출 (15곳 보일러플레이트)
- `HomeContent.tsx`에 pending_transfer 상태 표시 추가
- M8 관리자 CMS(배너 + 한 줄), M10 정산 + 회원 생애주기
- 운영 이메일 미확정 → 푸터 이메일 항목 보류
- deleted 모임의 계좌이체 환불 처리 한계 (`RefundToggle` 경로 차단, SQL로 우회)

## 핵심 참고 파일

- 패널 결정 기록: `docs/expert-panel/2026-07-16-ask-entry-alimtalk-pivot.md` (미커밋)
- 계측 로직: `src/lib/asks-pure.ts`, `src/lib/asks.ts` / 플래그: `src/lib/library.ts`
- 관리자 화면: `src/app/(admin)/admin/library/page.tsx`
- 루트 `CLAUDE.md` "Key Business Rules" + "Branching & Deployment Strategy"
