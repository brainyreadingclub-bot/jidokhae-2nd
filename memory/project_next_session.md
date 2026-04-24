---
name: 다음 세션 핸드오프
description: 세션 간 연속성을 위한 현재 상태 + 다음 할 일 + 블로커 정리. 매 회고마다 덮어쓰기.
type: project
---

## 현재 진행 상태 (2026-04-23, 세션 종료 시점)

**브랜치:** `feat/phase3-m7-step2-5-hotfix` (origin 미푸시, 작업 중)

**main 상태:** Phase 3 M7 Step 2까지 머지 완료
- `f6c2e63` feat(M7 Step 2): 운영자 개편 — 사이드바 + 대시보드 허브 + 모임 관리 분리 + 모임 폼 확장
- `5dc9c70` feat(M7 Step 1): 안정 기반 — 풀스캔 정리 + Phase 3 DB schema + 배포 정책

**진행 중: M7 Step 2.5 후속 보정 (hotfix)**
- 2026-04-23 풀스캔 실행 결과를 총괄책임자가 재검토 → 에이전트 오판 상당수 확인.
- 배포 차단급 Critical 3건 중 실질적으로는 **editor 개인정보 서버 차단**만 중요 결정. 나머지는 재해석으로 우선순위 조정.
- 상세: `검토문서/2026-04-23-풀스캔-후속-의사결정.md` 참조 (필수 숙독).

**커밋 계획:**
- **커밋 1 (docs)**: CLAUDE.md 역할 매트릭스 + 법적 면제 근거, 검토문서 신규, memory 갱신, prompts 템플릿 복원 — **이 세션에서 완료 중**
- **커밋 2 (stability)**: meeting-remind 병렬화 + `admin_confirm_transfer` DB Function + confirm 교차검증
- **커밋 3 (admin)**: editor 개인정보 서버 차단 + 배너 editor 권한 + 대시보드 매출 집계 + AdminMeetingsList 필터
- **커밋 4 (member)**: 원 단위 통일 + 비로그인자 meetings 컬럼 제한 + privacy 쿠키 안내

## 다음 할 일 (우선순위 순)

### 1. M7 Step 2.5 hotfix 나머지 커밋 (이번 브랜치에서)
커밋 2 → 3 → 4 순차. 각 커밋 후 `npm run prelaunch` 통과 필수.

**커밋 2 주의**:
- `admin_confirm_transfer` SQL은 기존 `register_transfer` 패턴 그대로 준거 (`supabase/migration-bank-transfer-functions.sql:132` 참조)
- `confirm-transfer/route.ts`의 `action='unconfirm'` 경로는 건드리지 않음. `action='confirm'`만 RPC 교체.
- ⚠️ **금지**: `admin_confirm_transfer` 성공 시 `sendRegistrationConfirmNotification` 호출. 운영자 월말 일괄 처리 때문. (CLAUDE.md 규칙)

**커밋 4 주의**:
- `MeetingActionButton.tsx:775`의 **"입금 완료" 버튼 카피는 변경 안 함** (논리적으로 정확. 검토문서 2.3 참조)
- `policy/meetings/page.tsx` SELECT 제한 시 `as Meeting` cast 유지하되 누락 필드는 null로 안전
- 배포 전 Vercel Preview에서 회원 플로우 실제 검증 필수

### 2. M7 Step 2.5 배포 (사용자 승인 후)
cherry-pick 3단계:
1. `feat/phase3-m7-step2-5-stable`: 커밋 1+2 → PR → 모니터링
2. `feat/phase3-m7-step2-5-admin`: 커밋 3 → PR → 모니터링
3. `feat/phase3-m7-step2-5-member`: 커밋 4 → PR → Preview 검증 후 prod

**prod DB 변경 필요**: `supabase/migration-phase3-m7-step2-5.sql` 실행. 사용자가 Supabase SQL Editor에서 수동 실행.

### 3. M7 Step 3 (WP7-5) — 회원 홈 개편
- `src/components/BottomNav.tsx` 확장 (2탭 → 3탭: 홈/모임 일정/내 신청)
- `/home/page.tsx` placeholder 신규
- `HomeContent.tsx`에 **pending_transfer 상태 표시 추가** (이월 항목. 이번 Step에서 같이 처리)
- 기본 랜딩은 `/` (모임 일정) 유지 예정. `phase3-preview.html` 참조.
- UI 선행: `/frontend-design` 충실 사용 (2026-04-18 지시)
- **Step 3 착수 시 첫 작업: API 인증 헬퍼 `requireUser`/`requireAdmin` 추출** (이월 항목. 15곳 보일러플레이트 정리. Step 3 새 API가 헬퍼 사용하도록)

### 4. M8 시작 — 관리자 CMS (배너 + 한 줄)
- WP8-1 배너 CRUD + Storage 업로드 — **editor 권한 허용** (배너 placeholder 페이지 가드 추가 필요)
- WP8-2 한 줄 승인 워크플로우
- UI 선행 필수

## 블로커/대기 사항

- **prod DB 변경 대기**: `admin_confirm_transfer` 함수 SQL은 커밋 2 배포 타이밍에 사용자가 직접 실행
- **운영 이메일 미확정**: 푸터 이메일 추가 항목은 이월. 운영 이메일 생성 시 site_settings에 추가

## 확정된 정책 / 의사결정 (2026-04-23)

다음 세션이 이 정책을 뒤집는 제안을 하지 않도록 **반드시 확인**:

### 역할 권한 매트릭스
- `admin`(총괄): 전체 (정산, 회원 개인정보, 사이트 설정, 배너, 한줄)
- `editor`(운영진): 모임 CRUD, 회원 조회(개인정보 제외), 출석 체크, **배너 + 한줄**
- `member`(회원): 일반 기능
- adminOnly: 정산, 회원 개인정보(phone/email), 사이트 설정

### 법적 확인 완료
- 간이과세자 → **통신판매업 신고 면제** (전자상거래법 시행령 §12 제1항 2호)
- GA4 동의 배너 **불필요** (현 규모, privacy 문구로 갈음)
- 변호사 자문 **불필요**

### 운영 정책
- **계좌이체 입금 확인 시 회원 알림톡 발송 금지**: 월말 일괄 처리 때문. 카드결제만 즉시 알림 유지.
- **"입금 완료" 버튼 카피 유지**: 실제 플로우상 과거형이 정확 (송금 후 누르는 버튼)

## 주의사항 (이전 교훈 + 이번 추가)

### 이번 세션 교훈
- **에이전트 보고서 맹신 금지**: 풀스캔 결과의 Critical도 코드 직접 확인해서 완화 조건/사업 맥락 반영. 법률/UX 영역은 특히.
- **총괄책임자가 명시 반려한 제안은 금지 사항으로 문서화**: 다음 세션이 같은 제안을 반복하지 않도록. (예: 입금 확인 알림톡)

### 기존 교훈
- `/frontend-design` 스킬 충실 사용 — UI 구성 작업 전 mockup/명세 산출물 만들기 (2026-04-18 지시)
- prod schema 의존 SQL 작성 시 grep 선행 — `feedback_db_schema_grep_first`
- 사용자가 prod 적용한 SQL은 git commit — `feedback_prod_sql_must_commit`
- 동일 파일 다중 수정 방지 — `feedback_phase_structure` (HomeContent 이월 이유)
- `(main)` 라우트 로컬 테스트 불가 — 검증은 Vercel Preview
- 두 톤 분리 원칙 — 문서 chrome(매거진B 다듬기) vs 모바일 mockup 안쪽(회원 친화 한국어)

## 참고 파일

- 이번 세션 의사결정: `검토문서/2026-04-23-풀스캔-후속-의사결정.md` (**필수 숙독**)
- 풀스캔 보고서: `verification-squad/reports/2026-04-23/`
- 루트 CLAUDE.md "Key Business Rules" 섹션 (역할 매트릭스 + 법적 면제 기록)
- 기획 문서:
  - `roadmap/work-packages-phase3.md` WP7-5 절 (M7 Step 3)
  - `roadmap/scenarios-phase3.md` 7-5-* 시나리오
- preview HTML: `phase3-preview.html`
