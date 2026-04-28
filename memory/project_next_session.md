---
name: 다음 세션 핸드오프
description: 세션 간 연속성을 위한 현재 상태 + 다음 할 일 + 블로커 정리. 매 회고마다 덮어쓰기.
type: project
---

## 현재 진행 상태 (2026-04-28, 문서 정리 세션 종료 시점)

**브랜치:** `main` (clean)

**최근 머지 (main):**
- `3efcda1` feat(pwa): introduce service worker for cold-start FCP (#26) — 4/28
- M7 Step 2.6 — 계좌이체 환불 토글 (`RefundToggle` + `mark-refunded` 양방향)
- M7 Step 2.5 — 풀스캔 후속 보정 (meeting-remind 병렬화 + `admin_confirm_transfer` RPC + editor 개인정보 차단 등)
- M7 Step 2 — 운영자 개편 (사이드바 + 대시보드 허브 + 모임 관리 분리 + 모임 폼 확장)
- M7 Step 1 — 안정 기반 (풀스캔 정리 + Phase 3 DB schema + 배포 정책)

**Phase 2 + Phase 3 M7 Step 1~2.6 + PWA 모두 prod에 배포 완료.**

## 다음 할 일 (우선순위 순)

### 1. M7 Step 3 — 회원 홈 (WP7-5)
**시작 시 첫 두 작업** (이월 항목, plan 작성 시 반드시 포함):
- **API 인증 헬퍼 `requireUser`/`requireAdmin` 추출** — 15곳 보일러플레이트 정리. Step 3 새 API가 이 헬퍼를 사용하도록 추출 후 진행
- **HomeContent.tsx에 pending_transfer 상태 표시 추가** — Step 2.5 이월 항목

**Step 3 본 작업:**
- `src/components/BottomNav.tsx` 확장 (2탭 → 3탭: 홈/모임 일정/내 신청)
- `/home/page.tsx` placeholder 신규 (실제 콘텐츠는 M9에서 채움)
- 기본 랜딩은 `/` (모임 일정) 유지
- UI 선행 필수: `/frontend-design` 스킬 (필수 규칙)
- mockup 참조: `phase3-preview.html` (4/21 기준, 전문가 패널 리뷰 거침)

### 2. M8 — 관리자 CMS (배너 + 한 줄)
- WP8-1 배너 CRUD + Storage 업로드 — **editor 권한 허용** (배너 placeholder 페이지 가드 추가 필요)
- WP8-2 한 줄 승인 워크플로우 (대기/승인/거절 탭)
- UI 선행 필수

### 3. (병렬 가능) M10 — 정산 + 회원 생애주기
- M7 의존만 있고 M8/M9와 병렬 가능 (마일스톤 의존성 그래프 확인)
- `/admin/settlements` admin 전용 + 5단계 회원 생애주기

## 블로커/대기 사항

- **운영 이메일 미확정**: 푸터 이메일 추가 항목은 이월. 운영 이메일 생성 시 site_settings에 추가
- **deleted 모임의 계좌이체 환불 처리 한계** (Phase 3 M7 Step 2.6 발견): `RefundToggle` 사용 경로 차단. 빈도 낮으면 SQL로 처리, 높아지면 deleted 모임 admin 상세 분기 수정 필요. 자세한 SQL은 CLAUDE.md "계좌이체 환불 처리 한계" 절

## 확정된 정책 / 의사결정 (반복 확인용)

다음 세션이 이 정책을 뒤집는 제안을 하지 않도록 **반드시 확인**:

### 역할 권한 매트릭스 (2026-04-23 확정)
- `admin`(총괄): 전체 (정산, 회원 개인정보, 사이트 설정, 배너, 한줄)
- `editor`(운영진): 모임 CRUD, 회원 조회(개인정보 제외), 출석 체크, **배너 + 한줄**
- `member`(회원): 일반 기능
- adminOnly: 정산, 회원 개인정보(phone/email), 사이트 설정

### 법적 확인 완료 (2026-04-23)
- 간이과세자 → **통신판매업 신고 면제** (전자상거래법 시행령 §12 제1항 2호)
- GA4 동의 배너 **불필요** (현 규모, privacy 문구로 갈음)
- 변호사 자문 **불필요**

### 운영 정책
- **계좌이체 입금 확인 시 회원 알림톡 발송 금지**: 월말 일괄 처리 때문. 카드결제만 즉시 알림 유지
- **"입금 완료" 버튼 카피 유지**: 실제 플로우상 과거형이 정확 (송금 후 누르는 버튼)

### 워크플로우 규칙
- **UI 작업 전 `/frontend-design` 스킬 선행 필수** (Phase 3 design 원칙 4)
- **(main) 라우트 검증은 Vercel Preview에서만** (로컬 OAuth 콜백 불가)
- **prod schema 의존 SQL 작성 시 grep 선행**

## 2026-04-28 문서 정리 변경 사항

이 세션에서 프로젝트 문서 대청소 진행:
- `검토문서/`: 13 → 7 + README. 회고 2건은 lesson 추출 후 폐기, 사이트 아키텍처 + 풀스캔 지시서 + Phase 2-3 검토의견은 superseded/흡수 처리
- `docs/expert-panel/`: UX-캘린더뷰 + 브랜드컬러 분석 이동 (검토문서 → expert-panel 일관성)
- `docs/superpowers/plans/`: 머지된 plan 2건에 Status 헤더 추가 (보존)
- `memory/`: feedback 1건 신설(`feedback_2026-03-18_kakaotalk-inapp-hydration.md`)
- `CLAUDE.md`: Document Structure 갱신 (위 변경 반영)

## 참고 파일

- `검토문서/README.md` — 카테고리 인덱스
- `검토문서/2026-04-23-풀스캔-후속-의사결정.md` — 정책 source
- 루트 CLAUDE.md "Key Business Rules" + "Branching & Deployment Strategy"
- `roadmap/work-packages-phase3.md` WP7-5 (M7 Step 3)
- `roadmap/scenarios-phase3.md` 7-5-* 시나리오
- `phase3-preview.html` — UI mockup baseline
