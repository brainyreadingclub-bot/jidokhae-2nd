---
name: 다음 세션 핸드오프
description: 세션 간 연속성을 위한 현재 상태 + 다음 할 일 + 블로커 정리. 매 회고마다 덮어쓰기.
type: project
---

## 한 줄 요약 (2026-07-28 기준)

서재+물어보기 기능은 prod에 배포됐지만 **기능 플래그 OFF라 회원 노출 0**. "물어보기를 회원에게 어떻게 도달·노출할까"를 확정(→ 알림톡 주 진입점)하고, 켜기 전 블로킹이던 계측 버그를 수정해 배포했다. 남은 켜기 게이트는 (1) 알림톡 점검, (2) 회원 콜드스타트 화면 시안 합의.

🚨 **2026-07-28 신규 발견: 알림톡 5종을 "아무도 받은 적 없다"(단무지님 제보).** 코드 추적 결과 계좌이체 운영과 알림 트리거 설계 사이에 구조적 공백이 있음(아래 "알림톡 미수신 조사" 절). **물어보기 알림톡(6번째)의 전제조건이 무너진 상태라 이게 최우선.**

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

## 알림톡 미수신 조사 (2026-07-28, 코드 추적까지 완료 / DB 확인 미완)

**증상:** 알림톡 5종을 회원 누구도 받은 적 없음.

**사실 정정:** 알림톡(정보성)은 **카카오채널 친구 추가 여부와 무관**하게 휴대폰 번호 기준 발송됨. 친구 추가가 필요한 건 친구톡/브랜드메시지. → "채널 수락 안 해서 못 받았다"는 원인이 아님.

**유력 가설 — 계좌이체 운영 × 트리거 설계의 구조적 공백:**

| 알림 | 실제 트리거 지점 | 계좌이체 운영 시 |
|---|---|---|
| 신청 확인 | `registrations/confirm`, `webhooks/portone` — **카드결제 성공 경로에만** | 발송 0 |
| 대기 확인 | 동일 | 발송 0 |
| 대기 승격 | `waitlist.ts:43` (확정자 취소 시) | 대기자 있어야 발생 |
| 미승격 환불 | `cron/waitlist-refund` | 대기자 있어야 발생 |
| 모임 리마인드 | `cron/meeting-remind/route.ts:64` — **`.eq('status','confirmed')`** | **대상 0명 가능** |

- 계좌이체 신청 라우트(`registrations/transfer`)에는 알림 호출이 **아예 없음**. 입금 확인(`confirm-transfer`)은 정책상 발송 금지(운영자 월말 일괄 처리).
- 리마인드는 모임 전날 KST 19:00에 도는데, 운영자가 입금 확인을 월말에 몰아 하므로 그 시점엔 대부분 `pending_transfer` → 조회 0명.
- **방증:** 커밋 `ad9741d`(7/15)가 *"confirmed만 필터하던 3곳을 `PARTICIPATED_STATUSES`로 통일 — 계좌이체 운영 중 대부분 참여자가 누락되던 문제 해소"* 로 물어보기 쪽 동일 버그를 고쳤는데, **리마인드 크론은 그 통일에서 빠짐.**

**확인 절차 (내일 여기서 시작):**

1단계 — Supabase SQL Editor (`ycqqzzvyixvtdorjxkrn`). ⚠️ Claude는 prod SQL 실행이 권한 정책으로 차단됨 → 단무지님이 실행 후 결과 공유:
```sql
select type, status, count(*), max(created_at) as last_at
from notifications group by 1,2 order by 3 desc;

select status, payment_method, count(*) from registrations group by 1,2;
select key, value from site_settings where key = 'payment_mode';
```
읽는 법:
- 행 0건 → 코드가 호출 자체를 안 함 = 위 구조적 공백 확정
- `failed` 다수 → `select error_message, count(*) from notifications where status='failed' group by 1;` (템플릿 ID·채널 미승인·env 누락)
- `skipped` + "전화번호 없음" → 프로필 전화번호 누락
- `sent`인데 미수신 → 코드 정상, Solapi/카카오 구간 문제 → 2단계

2단계 — Solapi 콘솔(console.solapi.com → 메시지 → 발송 내역): 발송 요청 자체가 없었는지 vs 실패했는지. **템플릿 5종 검수 상태(승인/반려)** 도 확인(반려면 전부 실패).

3단계 — Vercel → jidokhae-2nd → Cron Jobs: 마지막 실행 시각·결과. ⚠️ 런타임 로그 보존 짧음(7일 조회 시 보존 초과 확인됨) → 실시간으로 볼 것.

**원인 확정 후 수정 후보:** ① `cron/meeting-remind`를 `PARTICIPATED_STATUSES`(confirmed + pending_transfer)로 통일, ② 계좌이체 신청 시점 신청 확인 알림 발송 여부 결정(현 "입금 확인 알림 금지" 정책과 별개 사안 — 신청 접수 시점이라 월말 일괄 처리와 충돌 없음), ③ 채널 친구 현황은 카카오톡 채널 관리자센터(center-pf.kakao.com) 통계 / 회원별은 `plusfriends` 동의항목 + 채널 관계 REST API(단, 재동의 시점부터 집계라 250명 전수엔 부적합)

## 다음 할 일 (우선순위 순)

0. **[최우선 · 단무지님 1단계 SQL → Claude 수정]** 위 "알림톡 미수신 조사" 확인 절차. 알림톡이 실제로 안 나가는 상태면 6번째 템플릿을 추가해도 같은 이유로 안 나감.
1. **[단무지님 몫]** 알림톡 5종 실작동 점검 — 0번과 통합됨. 도달·심사·발송 로그 확인.
2. **알림톡 6번째 템플릿**(모임 다음날 오전 cron) — confirmed 참여자에게 1회, answered/dismissed는 dedup skip, 딥링크로 물어보기. 재사용 기반: `getPendingAsk`/`verifyEligibleParticipation`(`asks.ts`), 알림톡 5종 패턴(`notification.ts`·`solapi.ts`), `cron/meeting-remind`(KST 19:00) 구조. **1번 완료가 선행.**
3. **[켜기 전 게이트] 회원 콜드스타트 화면 시안 → 합의 → 검증** — 냅다 디자인 금지. 상태 전수(빈 서재/책 있음/물어보기 strip/소개 strip/겹침) → 흐름 서술 → HTML 목업 + 렌더 스크린샷 인라인 → 합의 → 구현 → 상태별 캡처. ⚠️ **일반 회원(빈 서재) 첫 노출 아직 미검증** (지금까지 등록 최다 계정으로만 확인).
4. 위 게이트 통과 → `site_settings.library_enabled='on'` 토글(배포 불필요) → 실제 전환율 측정 시작.

## 미결 / 주의

- ~~미커밋 문서 5건~~ → **2026-07-28 커밋·push 완료** (`ec8c1a8`, main 직접 push)
- ~~스테일 브랜치 2개~~ → **2026-07-28 정리 완료** (`feat/discussion-slice1` 원격+로컬 삭제, `fix/ask-stats-metric`은 이미 원격에서 삭제돼 있어 prune으로 정리)
- **콜드스타트 시안 미착수** — 7/28 세션에서 착수 승인까지 받았으나, 알림톡 미수신 발견으로 우선순위가 밀림. 내일 알림톡 원인 확정과 병렬 진행 가능.
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
