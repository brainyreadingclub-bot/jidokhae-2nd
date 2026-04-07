## 검증 종합 보고서

**검증 대상**: 계좌이체 브릿지 (feature/bank-transfer) + 전체 코드베이스 풀 스캔
**검증 일시**: 2026-04-06
**검증 모드**: 풀 스캔
**프로젝트**: JIDOKHAE 2nd

---

### Executive Summary (30초 읽기)

- **배포 권고**: 🟡 조건부 승인
- **배포 차단급 Critical**: 2건 — (1) 웹훅 RPC 실패 시 결제 환불 누락 (고아 결제), (2) 사용자 취소 시 환불 성공 + DB 실패 불일치 (자동 복구 부재)
- **조건부 통과급 Critical**: 3건 — (1) 개인정보 수집 동의 절차 부재, (2) 개인정보 국외이전 고지 누락, (3) 회원 탈퇴/개인정보 삭제 기능 미구현
- **즉시 판단 필요**: 배포 차단급 2건 모두 "redirect 실패 + DB 장애" 복합 조건에서만 발생하며, 250명 규모에서 발생 확률은 매우 낮음. 총괄 책임자가 위험 수용 여부를 판단해야 함.

---

### 1. 에이전트별 판정 요약

| # | 에이전트 | 판정 | Critical | Warning | Info | 특이사항 |
|---|---------|------|----------|---------|------|---------|
| 1 | 로직 감사관 | 🟡 조건부 통과 | 3건 | 7건 | 5건 | C-3(attendance body 파싱)은 admin 전용이므로 실질 영향 낮음 |
| 2 | 보안 공격자 | 🟡 조건부 통과 | 2건 (C-1 자체 하향→Warning) | 6건 | 5건 | 웹훅 서명 미검증을 자체 하향 조정 (getPayment 대체 검증 인정) |
| 3 | 데이터 수호자 | 🟡 조건부 통과 | 3건 (F1, F2=T3, T10) | 4건 | 3건 | 동시성 분석 가장 상세. TossPayments-DB 대사(reconciliation) 부재 지적 |
| 4 | 규정 준수관 | 조건부 통과 | 3건 (개인정보 동의/국외이전/탈퇴) | 4건 | 0건 | 법률 전문가 자문 필요 항목 다수 |
| 5 | 사용자 대변인 | (미작성) | - | - | - | 에이전트 리밋으로 보고서 미제출 |
| 6 | 인프라 감시자 | 조건부 통과 | 0건 | 0건 | 0건 | Cron 타임아웃/모니터링 부재를 "높음"으로 지적하나 Critical 미분류 |
| 7 | 일관성 심판관 | 조건부 통과 | 0건 | 0건 | 0건 | API 응답 포맷 혼재, 디자인 토큰 이탈, 중복 코드 지적 |

---

### 2. Critical 이슈 통합 목록 (우선순위순)

| 순위 | 이슈 요약 | 지적 에이전트 | 위치 | 영향 범위 | 가중치 등급 |
|------|---------|-------------|------|----------|-----------|
| 1 | **웹훅 RPC 실패 시 결제 환불 누락 (고아 결제)**: redirect + webhook 모두 실패 시, 돈만 빠지고 DB 기록/환불 모두 없음 | #1 (C-2), #3 (F1, T10) | `webhooks/tosspayments/route.ts:88-95` | 사용자 자금 손실, 수동 복구 필요 | **배포 차단급** |
| 2 | **사용자 취소 시 환불 성공 + DB 업데이트 실패 불일치**: TossPayments 환불 완료 후 DB가 confirmed로 남음. 재시도 시 자동 복구되나, 미재시도 시 불일치 지속 | #3 (F2, T3, T5) | `cancel.ts:78-133`, `waitlist.ts:107` | 참석자 수 과다 집계, 대기자 승격 누락 | **배포 차단급** |
| 3 | **웹훅 서명 검증 누락**: TossPayments 서명 미검증. getPayment() 대체 검증으로 위조 등록 차단되나, 스팸으로 API rate limit 소진 가능 | #1 (C-1), #2 (C-1→W 하향) | `webhooks/tosspayments/route.ts` 전체 | 서비스 가용성 (TossPayments API 할당량) | **배포 차단급** (로직 감사관) / Warning (보안 공격자) — 아래 모순 항목 참조 |
| 4 | **개인정보 수집 동의 절차 부재**: 카카오 로그인/프로필 설정 시 동의 체크박스 없음 | #4 (높음 1순위) | `LoginClient.tsx`, `ProfileSetup.tsx` | 개인정보보호법 제15조 위반, 과징금 매출액 3% | **조건부 통과급** |
| 5 | **개인정보 국외이전 고지 누락**: Supabase(AWS), Vercel, GA4로의 데이터 이전 미고지 | #4 (높음 2순위) | `policy/privacy/page.tsx` | 개인정보보호법 제28조의8 위반, 과태료 5천만원 | **조건부 통과급** |
| 6 | **회원 탈퇴/개인정보 삭제 기능 미구현**: UI/기능 없음 | #4 (높음 3순위) | 서비스 전체 | 개인정보보호법 제36-37조 위반, 과태료 5천만원 | **조건부 통과급** |
| 7 | **mark-refunded API 금액 검증 부재**: 음수/초과 금액 기록 가능 | #1 (W-5), #2 (C-2), #3 (F4) | `mark-refunded/route.ts:55-67` | 회계 무결성 (admin 전용이므로 외부 공격 제한적) | **배포 차단급** (보안 공격자) / Warning (로직/데이터) |
| 8 | **attendance API body 파싱 try-catch 누락** | #1 (C-3) | `attendance/route.ts:50` | admin 전용, 비정상 요청 시 500 에러 | **배포 차단급** (로직 감사관) — 실질 영향은 낮음 |

---

### 3. 에이전트 간 교차 발견

| 문제 | 에이전트 A 관점 | 에이전트 B 관점 | 통합 심각도 |
|------|--------------|--------------|-----------|
| 웹훅 RPC 실패 시 고아 결제 | #1: rpcResult가 null이면 모든 분기 미매칭 → `{ status: 'ok' }` 반환 (코드 경로 분석) | #3: redirect 실패 + webhook RPC 실패 = 고아 결제. 자동 복구 메커니즘 없음 (데이터 흐름 분석) | **Critical** — 두 에이전트 모두 독립적으로 동일 결함 도달. 코드 직접 확인 완료 (route.ts:88-95, 137행) |
| 웹훅 서명 미검증 | #1: CLAUDE.md에 "Signature verification required" 명시 위반 | #2: getPayment()으로 실질 위조 차단되나 스팸 벡터 존재 | **Warning~Critical** — 실제 금전 피해 없으나 API 할당량 소진 위험 |
| `new Date().toISOString()` 사용 | #1 (W-1): DB 컬럼 타입에 따라 9시간 차이 가능 | #3 (F7): timestamptz이므로 기술적으로 올바르나 컨벤션 위반 | **Info** — #6, #7도 동일 지적. timestamptz 컬럼이면 무해. 컨벤션 예외 문서화 필요 |
| mark-refunded 금액 검증 부재 | #1 (W-5): 음수/NaN 통과 | #2 (C-2): admin 계정 탈취 시 재무 기록 조작 | **Warning** — admin 전용이므로 외부 공격 확률 낮으나, 0 <= amount <= paid_amount 검증은 필수 |
| Rate limiting 부재 | #2 (W-1): 결제/취소 API 무차별 호출 가능 | #6 (추가 발견 5): 결제 API 반복 호출 방지 권장 | **Warning** — 250명 규모에서 악용 확률 낮으나, 기본 보호 필요 |
| Security headers 미설정 | #2 (W-2): Clickjacking 가능 | #6 (추가 발견): CSP/HSTS 등 미설정 | **Warning** — next.config.ts에 헤더 추가로 즉시 해결 가능 |
| 계좌이체 대기자 Cron 환불 시 알림톡 미발송 | #1 (W-6): continue로 알림톡 건너뜀 | (코드 직접 확인) `route.ts:59` — `continue` 이후 알림톡 호출 없음 | **Warning** — 계좌이체 사용자에게 미승격 환불 사실 미통보 |

---

### 4. 에이전트 간 모순 (있는 경우)

| 영역 | 에이전트 A 판정 | 에이전트 B 판정 | 코드 직접 참조 | 총괄 책임자 판단 필요 |
|------|--------------|--------------|-------------|-------------------|
| 웹훅 서명 미검증 심각도 | #1 (로직): **Critical** — CLAUDE.md 명세 위반이며 위조 paymentKey + 이미 결제된 건 재시도 공격 가능 | #2 (보안): **자체 하향 → Warning** — getPayment() 대체 검증으로 실제 금전 피해 없음, 스팸/DoS만 위험 | `route.ts:29-35` — getPayment()이 결제 상태 DONE 확인 후 진행. 이미 처리된 paymentKey는 멱등성 체크(`payment_id` 기존 등록)로 차단됨. **보안 공격자(#2) 판정이 더 정확**: 실질적 금전 피해 경로 없음. 단, CLAUDE.md 명세 위반은 사실이므로 수정 필요 | Warning으로 분류하되 수정 우선순위 높게 배치할 것인지 판단 필요 |
| mark-refunded Critical 등급 | #2 (보안): **Critical** — admin 계정 탈취 시 재무 기록 조작 | #1 (로직), #3 (데이터): **Warning** — admin 전용 API이므로 영향 범위 제한적 | `mark-refunded/route.ts:63-67` — admin role 체크 통과 필수. refundedAmount 범위 미검증은 사실이나 실제 금전 이동(TossPayments 호출)은 없음. DB 기록만 영향 | admin 전용이므로 Warning이 적절. 단, 범위 검증 추가는 필수 |
| 동시성 C7 (confirm-transfer vs cancel) | #3 (데이터): **Critical** 분류 후 본문에서 "실제로는 안전" 판정 | (다른 에이전트 미언급) | `confirm-transfer`는 `.eq('status', 'pending_transfer')`, cancel은 `.eq('status', reg.status)` — optimistic lock으로 하나만 성공. **안전함** | 실질적 Critical 아님. #3도 본문에서 안전 판정 완료 |

---

### 5. 프로필 정보 부족 종합

| 부족 항목 | 언급 에이전트 | 검증 영향 |
|----------|------------|----------|
| Supabase 플랜 (Free/Pro) 미확인 | #3, #6 | 자동 백업 지원 여부, DB 커넥션 풀 한도, Point-in-Time Recovery 가용성 판단 불가 |
| DB 컬럼 타입 (timestamptz vs timestamp) 미확인 | #1 | `new Date().toISOString()` 사용 시 9시간 차이 발생 여부 판단 불가 |
| Supabase Auth 세션 만료 시간 미확인 | #2 | 토큰 만료 정책의 적절성 판단 불가 |
| CRON_SECRET 엔트로피 미확인 | #2 | 브루트포스 가능성 판단 불가 |
| 통신판매업 신고 대상 여부 | #4 | 면제 조건 충족 여부 전문가 확인 필요 |
| 14세 미만 아동 수집 제한 적용 여부 | #4 | 카카오 OAuth가 일부 커버하나 서비스 자체 확인 메커니즘 부재 |
| 계좌이체 브릿지 관련 CLAUDE.md 미반영 | #2, #7 | feature/bank-transfer의 신규 파일/라우트가 문서에 미기재 |

---

### 6. 배포 판정 권고

**권고**: 🟡 조건부 승인

**권고 사유**:

6개 에이전트 전원 "조건부 통과" 판정. 핵심 결제/취소/환불 흐름의 안전 패턴(멱등성, FOR UPDATE 락, optimistic lock, safeCancel)은 견고하게 구현되어 있다.

**배포 차단급 Critical 2건의 발생 조건 분석**:
1. **고아 결제 (웹훅 RPC 실패)**: "프론트엔드 redirect 실패" + "webhook에서 DB RPC도 실패"의 복합 조건. DB 장애가 아니면 발생하지 않으며, 250명 규모에서 확률 극히 낮음.
2. **취소 불일치 (환불 성공 + DB 실패)**: TossPayments 환불 완료 후 Supabase DB 업데이트 실패. 사용자 재시도 시 자동 복구됨. 대기 취소 건은 Cron catch-up으로도 복구.

두 건 모두 **발생 확률은 극히 낮으나, 발생 시 수동 개입이 필요**하다. 250명 소규모 서비스 특성상 위험을 수용할 수 있으나, 자동 복구 메커니즘(reconciliation 배치) 도입을 1차 배포 후 우선 과제로 권장.

**조건부 통과급 Critical 3건(개인정보 관련)**은 법적 리스크이나 코드 배포와 직접 관련되지 않는 정책/기능 사항이므로, 배포 차단 사유보다는 출시 전 필수 보완 항목으로 분류.

**조건부 승인의 조건**:
1. 웹훅 RPC 실패 시 에러 로깅 강화 (최소 조치) 또는 cancelPayment 호출 추가 (권장)
2. mark-refunded API에 `0 <= refundedAmount <= paid_amount` 범위 검증 추가
3. 개인정보 수집 동의/국외이전 고지를 1차 배포 전 또는 직후 보완 계획 수립

> **이 권고는 판단 근거를 제공할 뿐이며, 최종 결정은 총괄 책임자에게 있습니다.**

---

### 7. 다음 조치 액션 아이템

#### 즉시 수정 (Critical)

| # | 항목 | 출처 | 예상 작업량 |
|---|------|------|-----------|
| A1 | 웹훅 RPC 실패 시 cancelPayment 호출 또는 에러 반환 추가 (`route.ts:88-95`에 rpcError 체크 + 환불 로직) | #1 C-2, #3 F1 | 소 (10줄 내외) |
| A2 | mark-refunded API에 refundedAmount 범위 검증 추가 (`0 <= amount <= paid_amount`) | #1 W-5, #2 C-2, #3 F4 | 소 (5줄 내외) |
| A3 | 개인정보처리방침에 국외이전 항목 추가 (Supabase/AWS, Vercel, Google Analytics) | #4 높음 2순위 | 중 (정책 문서 수정) |
| A4 | 개인정보처리방침에 Solapi, Google Analytics 위탁 항목 추가 | #4 중간 5순위 | 소 (정책 문서 수정) |

#### 일정 내 수정 (Warning)

| # | 항목 | 출처 | 예상 작업량 |
|---|------|------|-----------|
| B1 | TossPayments 웹훅 서명(HMAC) 검증 추가 | #1 C-1, #2 C-1 | 중 |
| B2 | `next.config.ts`에 보안 헤더 추가 (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`) | #2 W-2, #6 | 소 |
| B3 | 개인정보 수집 동의 체크박스 추가 (로그인/프로필 설정 화면) | #4 높음 1순위 | 중 |
| B4 | 회원 탈퇴 기능 구현 또는 탈퇴 요청 안내 추가 | #4 높음 3순위 | 대 |
| B5 | Cron 순차 처리 병렬화 (waitlist-refund 30건 초과 시 10초 타임아웃 위험) | #6 1순위 | 중 |
| B6 | `pending_transfer` 자동 만료 로직 추가 (24시간 미입금 시 자동 취소) | #2 W-5 | 중 |
| B7 | 계좌이체 대기자 Cron 환불 시 알림톡 발송 추가 (`continue` 전에 알림 호출) | #1 W-6 | 소 |
| B8 | 쿠키/추적 동의 배너 추가 (GA4 동의 전 로드 지연) | #4 중간 4순위 | 중 |
| B9 | TossPayments-DB 간 정기 대사(reconciliation) 배치 도입 | #3 F2 | 대 |
| B10 | 에러 추적 도입 (Sentry 등) | #6 2순위 | 중 |
| B11 | 계좌이체 waitlisted 모임 삭제 시 refunded_amount 의미 명확화 | #1 W-3, #3 F6 | 소 |
| B12 | 필수 환경변수 시작 시 검증 로직 추가 | #6 3순위 | 소 |

#### 백로그 추가 (Info)

| # | 항목 | 출처 |
|---|------|------|
| C1 | API 응답 포맷 통일 (`{ success: true }` 표준화) | #7 |
| C2 | Spinner/StickyBottom 공통 컴포넌트 추출 (`ui/` 디렉토리) | #7 |
| C3 | API route 인증 보일러플레이트 공통 유틸 추출 | #7 |
| C4 | skeleton/error 파일의 Tailwind `gray-*` → `neutral-*` 토큰 교체 | #7 |
| C5 | rgba 하드코딩 → CSS 변수 정의 | #7 |
| C6 | Uptime 모니터링 도입 | #6 |
| C7 | Admin API의 `error.message` 노출 제거 (제네릭 메시지 대체) | #2 W-4 |
| C8 | CLAUDE.md에 계좌이체 브릿지 관련 신규 파일/라우트 반영 | #2, #7 |
| C9 | `new Date().toISOString()` 타임스탬프 기록 용도의 컨벤션 예외 문서화 | #1 I-1, #3 F7, #7 |
| C10 | TransferForm.tsx 미사용 prop `meetingFee` 제거 | #7 |
| C11 | 결제 완료 화면에 주문번호(orderId), 결제일시 표시 추가 | #4 낮음 9순위 |
| C12 | 알림톡 수신거부 수단 / 수신 설정 기능 추가 | #4 중간 7순위 |
