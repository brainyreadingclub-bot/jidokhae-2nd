## 인프라 안정성 보고서

**검증 대상**: `C:\jidokhae-2nd\jidokhae-web` (전체 서비스 인프라)
**검증 일시**: 2026-04-06
**프로젝트**: JIDOKHAE 2nd

### 프로필 기반 파악 사항
- 호스팅/배포: Vercel (auto-deploy from Git)
- 데이터베이스: PostgreSQL (Supabase)
- 외부 서비스: TossPayments, Solapi (알림톡), Vercel Analytics, GA4
- 예상 트래픽: 일일 ~250명, 동시 접속 ~50명
- 비용 제약: Vercel Pro, Supabase Free/Pro tier
- Cron Jobs: waitlist-refund (KST 18:30), meeting-remind (KST 19:00)
- Vercel 제한: 10초 함수 타임아웃 (Pro 기준)

---

### 환경 설정 상태

| 항목 | 개발 환경 | 프로덕션 환경 | 상태 |
|------|---------|------------|------|
| 환경변수 분리 | `.env.local` (gitignore 적용) | Vercel Environment Variables | 정상 — `.gitignore`에 `.env*.local`, `.env.development`, `.env.production` 포함 |
| `SUPABASE_SERVICE_ROLE_KEY` 노출 방지 | `NEXT_PUBLIC_` 접두사 없음 | 서버 전용 사용 (`admin.ts`) | 정상 — 클라이언트 번들에 포함 불가 |
| `TOSSPAYMENTS_SECRET_KEY` 노출 방지 | `NEXT_PUBLIC_` 접두사 없음 | 서버 전용 사용 (`tosspayments.ts`) | 정상 |
| `CRON_SECRET` 인증 | Bearer 토큰 비교 | Vercel Cron 전용 | 정상 — 두 cron 엔드포인트 모두 `Authorization: Bearer` 검증 |
| Supabase 클라이언트 분리 | 3종 (server/client/admin) | 동일 | 정상 — anon key(RLS) vs service_role(bypass) 명확 분리 |
| `next.config.ts` 보안 헤더 | 미설정 | 미설정 | **주의** — `X-Frame-Options`, `Content-Security-Policy`, `Strict-Transport-Security` 등 보안 헤더 미설정. Vercel 기본 제공 헤더에 의존 중 |
| `.env.example` | 18개 변수 정의, 값 없음 | — | 정상 — 키 이름만 공개, 값 미포함 |

---

### 외부 서비스 한도 분석

| 서비스 | 현재 플랜 | 한도 | 예상 월 사용량 | 초과 위험 | 초과 시 비용 |
|--------|---------|------|-------------|----------|------------|
| **Vercel** | Pro | Serverless 함수 1,000 GB-hrs, 100GB 대역폭 | 250명 x 30일 = ~7,500 방문/월. 함수 호출 ~15,000/월 | 낮음 | $40/100GB 대역폭 초과 |
| **Vercel Cron** | Pro | 일 2회 실행 (vercel.json) | 60회/월 (2 x 30) | 없음 | Pro 포함 |
| **Supabase** | Free tier 가정 | DB 500MB, Auth 50,000 MAU, 500MB 스토리지, API 무제한 | 250 MAU, DB ~50MB | 낮음 | Pro $25/월 (8GB DB, 100,000 MAU) |
| **Supabase** | Pro tier 가정 | DB 8GB, 100,000 MAU | 위와 동일 | 매우 낮음 | 추가 스토리지 $0.125/GB |
| **TossPayments** | 표준 | 건당 수수료 (카드 ~3.2%) | ~250명 x 2회 = ~500건/월 | 없음 (건당 과금) | 건당 수수료만 |
| **Solapi 알림톡** | 종량제 | 건당 ~8.4원 (카카오 알림톡) | 5종 x 500건 = ~2,500건/월 (최대) | 낮음 | ~21,000원/월 |
| **GA4** | 무료 | 이벤트 무제한 (무료 tier) | ~7,500 페이지뷰 + 이벤트 | 없음 | 무료 |
| **Vercel Analytics** | Pro 포함 | 커스텀 이벤트 포함 | ~7,500/월 | 없음 | Pro 포함 |

---

### 서비스 가용성 영향 분석

| 장애 시나리오 | 서비스 응답 상태 | 리소스 고갈 위험 | 사용자 영향 | 권장 조치 |
|-------------|---------------|---------------|-----------|----------|
| **Supabase 장애** | 전체 서비스 불능 — 인증, DB 조회, 모든 API 실패 | 없음 (서버리스) | **치명적** — 로그인, 모임 조회, 신청 모두 불가 | Supabase 상태 페이지 구독. error.tsx 경계가 존재하나, 사용자에게 "일시적 오류" 메시지만 표시. 별도 상태 페이지(Statuspage 등) 부재 |
| **TossPayments 장애** | 결제/환불 불가, 조회는 정상 | 없음 | **높음** — 신규 신청 불가, 취소 시 환불 실패 | `safeCancel()` 패턴으로 환불 실패 시 등록 유지 (돈 안전성 확보). 단, 재시도 메커니즘 없음 — 사용자가 수동 재시도해야 함 |
| **Solapi 장애** | 알림톡 발송 실패, 핵심 흐름(결제/취소) 정상 | 없음 | **낮음** — 알림 누락만 발생, 결제/신청 흐름은 영향 없음 | 모든 알림 발송이 try-catch로 격리됨 (fire-and-forget). `notifications` 테이블에 `failed` 상태로 기록되어 사후 확인 가능. 자동 재발송 메커니즘은 없음 |
| **Vercel 장애** | 전체 서비스 불능 | 없음 | **치명적** — 웹사이트 접근 불가 | 단일 호스팅 의존. CDN 레벨 장애 시 대안 없음 |
| **Kakao OAuth 장애** | 로그인 불가, 기존 세션은 유지 | 없음 | **중간** — 신규 로그인 불가, 기존 로그인 사용자는 세션 만료 전까지 정상 | 단일 인증 수단 의존 |
| **Cron 실행 실패** | waitlist-refund 또는 remind 미실행 | 없음 | **중간** — 대기자 자동 환불 누락 또는 리마인드 미발송 | catch-up 쿼리(`date <= tomorrow`)로 다음날 자동 재시도됨. 단, cron 실패 알림 메커니즘 없음 (Vercel 대시보드에서 수동 확인 필요) |
| **Webhook 미수신** | TossPayments 콜백 누락 | 없음 | **낮음** — 프론트엔드 redirect가 주 흐름이므로 webhook은 backup. redirect 자체도 실패하면 결제 확인 안 됨 | payment_id 멱등성으로 이중 처리 방지. 단, redirect + webhook 모두 실패 시 "결제됐으나 신청 미확정" 상태 발생 가능 — 수동 확인 필요 |
| **동시 접속 폭주 (~250명 동시)** | DB FOR UPDATE 락 직렬화로 느려짐 | Supabase 커넥션 풀 소진 가능 | **중간** — 결제 확인 지연, 타임아웃 가능 | 250명 규모에서는 현실적으로 발생 확률 낮음. 모임 개설 시 50명 이상 동시 결제 시나리오만 주의 |

---

### 성능 병목 지점

| 병목 | 현재 상태 | 예상 영향 | 심각도 |
|------|---------|----------|--------|
| **Cron 내 순차 처리** | `waitlist-refund`와 `meeting-remind` 모두 `for...of` 루프로 순차 실행. TossPayments API + Solapi API를 건별 호출 | 대기자 30명 이상이면 10초 Vercel 타임아웃 초과 가능 | **높음** |
| **모임 삭제 배치 환불** | `Promise.allSettled`로 병렬화 완료 | 다수 참가자(20명+) 환불 시 10초 한계 근접 가능하나, 병렬 처리로 현재 규모에서는 안전 | 낮음 |
| **Supabase 클라이언트 매 요청 생성** | `createServiceClient()`가 매 호출마다 새 클라이언트 인스턴스 생성. 커넥션 풀링은 Supabase 측에서 처리 | Supabase JS 클라이언트는 HTTP 기반(REST)이므로 커넥션 풀 문제 없음. 서버리스 환경에 적합 | 없음 |
| **Dashboard 집계 쿼리** | `dashboard.ts`에서 4~5개 쿼리를 `Promise.all`로 병렬 실행. 전체 registrations/profiles 스캔 포함 | 데이터 증가 시(수천 건) 느려질 수 있으나, 250명 규모에서는 무시 가능. 인덱스 활용 확인 필요 | 낮음 |
| **알림톡 발송 중 DB 조회** | `notification.ts`의 래퍼 함수들이 매번 meeting/profile을 개별 조회 후 발송 | cron 루프와 결합 시 N+1 패턴이지만, meeting-remind는 이미 JOIN으로 최적화. waitlist-refund도 JOIN 사용 중 | 낮음 |
| **Webhook orderId LIKE 쿼리** | `LIKE '{8chars}%'` 프리픽스 검색 — UUID 테이블에서 인덱스 활용 가능 | 250명 규모에서 문제없음 | 없음 |
| **React `cache()` 범위** | `auth.ts`, `profile.ts`, `meeting.ts`, `site-settings.ts`에서 React `cache()` 사용 — 동일 렌더링 내에서만 유효 | 의도된 설계. 요청 간 캐시 공유 없음. ISR/revalidate 미사용 — 모든 페이지가 동적 렌더링 | 없음 |

---

### 모니터링 / 알림 체계

| 항목 | 상태 | 비고 |
|------|------|------|
| **에러 추적 (Sentry 등)** | **미도입** | `console.error`만 사용 중 (20건). Vercel Runtime Logs로 확인 가능하나, 알림/집계/스택트레이스 추적 불가 |
| **Uptime 모니터링** | **미도입** | 서비스 다운 시 알림 받을 수 없음 |
| **Cron 실행 모니터링** | **미도입** | cron 실패 시 알림 없음. Vercel 대시보드에서 수동 확인만 가능 |
| **외부 서비스 장애 감지** | **미도입** | Supabase/TossPayments/Solapi 장애 시 사전 감지 불가 |
| **Error Boundary** | 도입 완료 | `(main)/error.tsx`, `(admin)/error.tsx` — 클라이언트 에러 캐치 후 재시도 UI 제공 |
| **Analytics** | 도입 완료 | Vercel Analytics + GA4 — 페이지뷰, 이벤트 퍼널 추적 |
| **DB 쿼리 성능 모니터링** | **미도입** | Supabase 대시보드에서 수동 확인만 가능 |
| **알림톡 발송 이력** | 도입 완료 | `notifications` 테이블에 pending/sent/failed/skipped 상태 기록 |
| **환불 실패 추적** | 부분 도입 | `console.error`로 로깅. 모임 삭제 시 `deleting` 상태 유지로 재시도 가능. 개별 환불 실패는 수동 확인 필요 |

---

### 롤백 준비 상태

| 항목 | 상태 | 비고 |
|------|------|------|
| **Vercel 즉시 롤백** | 가능 | Vercel 대시보드에서 이전 배포로 즉시 롤백 가능 (Git revert 불필요) |
| **DB 마이그레이션 롤백** | **수동 대응 필요** | `supabase/migration.sql` 수동 실행 방식 — 롤백 SQL 미작성. 스키마 변경 시 롤백 계획 수립 필요 |
| **환경변수 롤백** | 가능 | Vercel Environment Variables에서 이전 값으로 변경 후 재배포 |
| **기능 플래그** | **미도입** | 기능 단위 on/off 불가. 전체 배포 단위로만 롤백 |
| **블루/그린 배포** | 부분 가능 | Vercel Preview Deployments로 사전 검증 가능. 프로덕션은 단일 인스턴스 |

---

### 확장성 분석

| 항목 | 현재 상태 | 250명 규모 적합성 | 1,000명 이상 시 조치 필요 사항 |
|------|---------|-----------------|---------------------------|
| **서버리스 함수** | Vercel Serverless (auto-scale) | 적합 | 별도 조치 불필요 |
| **DB 동시 접속** | Supabase Pooler (자동) | 적합 | Supabase Pro 이상 권장 |
| **결제 동시성** | `FOR UPDATE` 행 락 | 적합 — 직렬화 대기 시간 무시 가능 | 핫스팟(인기 모임 동시 결제) 시 큐 도입 검토 |
| **Cron 처리량** | 순차 루프 (for...of) | 10~20건이면 10초 내 가능 | **30건 초과 시 배치 분할 또는 병렬화 필요** |
| **알림톡 발송** | 건별 Solapi API 호출 | 적합 | Solapi 대량 발송 API 전환 검토 |
| **정적 자산** | Vercel CDN 자동 캐싱 | 적합 | 별도 조치 불필요 |
| **DB 데이터량** | 인덱스 적용 (6개 주요 인덱스) | 적합 | registrations 테이블 아카이빙 정책 검토 (1년 후) |

---

### 추가 발견 사항

1. **TossPayments Webhook 서명 미검증**: `webhooks/tosspayments/route.ts`에서 요청 서명(HMAC) 검증 없이 `paymentKey`로 TossPayments API를 직접 조회하여 검증. 이 방식 자체는 안전하나 (TossPayments 측 데이터로 확인), 불필요한 API 호출이 발생. TossPayments 서명 검증을 추가하면 허위 webhook 요청을 API 호출 전에 차단 가능.

2. **`new Date().toISOString()` 직접 사용**: `cancel.ts`, `waitlist.ts`, `waitlist-refund/route.ts`, `meetings/[id]/delete/route.ts` 등에서 `cancelled_at` 기록 시 `new Date().toISOString()` 직접 사용. 프로젝트 컨벤션은 KST 유틸 사용이나, `cancelled_at`은 ISO 타임스탬프 기록 목적이므로 UTC 기반 `new Date()`가 적절. 다만 일관성 확인 필요.

3. **API Route에 글로벌 에러 핸들러 없음**: 각 API Route에 `try-catch`가 개별 적용되어 있으나, 예상치 못한 에러(예: JSON 파싱 외 런타임 에러) 시 500 응답 없이 Vercel 기본 에러 반환. 글로벌 API 에러 핸들러 도입 시 일관된 에러 응답 보장 가능.

4. **`!` Non-null assertion 다수 사용**: 환경변수 접근 시 `process.env.KEY!` 패턴 사용. 환경변수 누락 시 런타임에서 `undefined`가 전파되어 암호화 실패, 인증 실패 등 예측 불가한 에러 발생. 서버 시작 시 필수 환경변수 검증 로직 부재.

5. **Rate Limiting 미도입**: 결제 확인(`/api/registrations/confirm`), 취소(`/api/registrations/cancel`) 등 핵심 API에 rate limiting 없음. 250명 규모에서는 악의적 남용 가능성 낮으나, 결제 API 반복 호출 방지를 위해 최소한의 보호 권장.

---

### 종합 판정: 조건부 통과

**판정 사유**: 250명 규모 독서모임 서비스로서 핵심 안전장치(결제 멱등성, 원자적 락, 알림 격리, 환불 안전)는 잘 구현되어 있으나, **운영 모니터링 부재**(에러 추적, uptime, cron 감시)와 **cron 순차 처리의 타임아웃 위험**이 프로덕션 안정성을 위협하는 주요 리스크.

**우선 조치 권장 (심각도순)**:

| 순위 | 항목 | 사유 |
|:----:|------|------|
| 1 | Cron 순차 처리 병렬화 | `waitlist-refund` 대기자 30건 초과 시 10초 타임아웃으로 환불 실패 |
| 2 | 에러 추적 도입 (Sentry 등) | `console.error`만으로는 프로덕션 에러 감지/대응 불가 |
| 3 | 필수 환경변수 시작 시 검증 | `!` assertion 실패 시 암묵적 런타임 에러 — 배포 직후 감지 불가 |
| 4 | Uptime 모니터링 도입 | 서비스 다운 시 운영자 인지 불가 |
| 5 | 보안 헤더 추가 (`next.config.ts`) | CSP, HSTS 등 기본 보안 강화 |
