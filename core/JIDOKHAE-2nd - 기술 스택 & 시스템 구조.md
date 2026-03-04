# JIDOKHAE 기술 스택 & 시스템 구조

> 이 문서는 AI 코딩 에이전트가 개발 시 참고하는 기술 문서입니다.
> 서비스 개요와 PRD에 정의된 "무엇을(What)"을 "어떻게(How)" 구현하는지 정의합니다.
> 기술적 판단이 필요할 때 이 문서의 구조와 규칙을 기준으로 결정하세요.

---

## 1. 기술 스택

### 1-1. 확정 스택

| 영역 | 기술 | 버전 기준 | 선정 이유 |
|------|------|----------|----------|
| 언어 | TypeScript | 최신 안정 버전 | 타입 안전성, AI 에이전트 코드 생성 퀄리티 최고 |
| 프레임워크 | Next.js (App Router) | 최신 안정 버전 | 풀스택(프론트+API), 레퍼런스 최다, Vercel 최적 연동 |
| DB + 인증 | Supabase (PostgreSQL) | — | 관계형 DB, 카카오 OAuth 지원, RLS 내장, 관리 대시보드 |
| 호스팅 | Vercel | — | Next.js 최적, GitHub push 시 자동 배포 |
| 결제 | 포트원 (PortOne) | V2 API | 통합 결제/환불 API, PG사 비종속, 이용료 무료 |
| PG사 | 토스페이먼츠 또는 NHN KCP | — | 포트원을 통해 연결, 카드 결제 수수료 약 3.2~3.5% |

### 1-2. 비용 구조

**MVP 운영 비용 (무료 티어 기준)**

| 항목 | 플랜 | 월 비용 | 한도 |
|------|------|--------|------|
| Vercel | Hobby (무료) | 0원 | 월 100GB 대역폭 |
| Supabase | Free | 0원 | 500MB DB, 월 5만 MAU |
| 포트원 | 무료 | 0원 | — |
| PG사 수수료 (3.3%) | 월 100건 × 10,000원 기준 | ~33,000원 | — |
| **합계** | | **~33,000원/월** | |

> 250명 규모에서 무료 티어 한도를 초과할 가능성은 거의 없다. 서비스가 안정된 후 필요 시 Pro 플랜으로 업그레이드한다.

### 1-3. 스택 간 연결 관계

- **Next.js ↔ Supabase (프론트엔드)**: Supabase Client SDK + anon key + 사용자 JWT로 직접 DB 조회 (RLS 적용)
- **Next.js API Routes ↔ Supabase (서버)**: Supabase Admin Client + service_role key로 DB 접근 (RLS 우회, 비즈니스 로직 검증은 코드에서 수행)
- **Next.js API Routes ↔ 포트원**: 결제 검증, 환불 처리는 반드시 서버(API Routes)에서 포트원 REST API를 호출
- **Next.js API Routes ↔ Supabase**: 결제 검증 후 신청 데이터 확정, 취소/환불 상태 업데이트
- **프론트엔드 ↔ 포트원 SDK**: 결제창을 여는 역할만 (결제 검증은 서버에서)
- **Supabase Auth ↔ 카카오 OAuth**: Supabase가 카카오 인증을 중개

---

## 2. 시스템 구조

### 2-1. 전체 구조

```
[사용자 브라우저 (모바일)]
   │              │
   │              ├──→ [포트원 SDK] ──→ [PG사 결제창]
   │              │       (결제 팝업)
   ▼              ▼
[Next.js 프론트엔드 — Vercel]
   │
   ├── 단순 조회 ──→ [Supabase Client] ──→ [Supabase DB + RLS]
   │
   └── 민감한 처리 ──→ [Next.js API Routes — Vercel Serverless]
                           │              │              │
                           ▼              ▼              ▼
                     [Supabase DB]  [포트원 REST API]  [카카오 OAuth]
                                     (결제검증/환불)
                                          │
                                          ▼
                                    [PG사 — 토스페이먼츠/KCP]

[운영자 브라우저 (PC/모바일)] ──→ 같은 Next.js 앱 (권한으로 분리)
```

### 2-2. 처리 경로 분류

| 처리 유형 | 경로 | 이유 |
|----------|------|------|
| 모임 일정 목록 조회 | 프론트 → Supabase 직접 | 단순 읽기, RLS로 보안 충분 |
| 내 신청 내역 조회 | 프론트 → Supabase 직접 | RLS로 본인 데이터만 반환 |
| 모임 생성/수정 | 프론트 → Supabase 직접 | RLS로 운영자만 허용 |
| 모임 삭제 | 프론트 → API Route → (포트원) → Supabase | 신청자 유무 관계없이 항상 API Route 경유. 신청자 있으면 환불 후 삭제, 없으면 바로 삭제 |
| 모임 신청 + 결제 | 프론트 → API Route → 포트원 → Supabase | 결제 검증 필수, 정원 체크 필수 |
| 취소 + 환불 | 프론트 → API Route → 포트원 → Supabase | 환불 API 호출, 금액 계산 |
| 카카오 로그인 | 프론트 → Supabase Auth → 카카오 | Supabase가 OAuth 중개 |

### 2-3. 권한 분리

같은 Next.js 앱 안에서 Supabase RLS(Row Level Security)로 권한을 분리한다.

- **회원(member)**: 모임 목록 조회, 자기 신청 조회/취소만 가능
- **운영자(admin)**: 모임 CRUD, 모든 신청자 목록/결제 상태 조회 가능

별도 관리자 앱을 만들지 않는다.

**운영자 식별 방법**: 카카오 로그인 시 모든 사용자는 member로 등록된다. 영탁(단무지)님의 계정만 Supabase 대시보드에서 수동으로 role을 admin으로 설정한다. MVP에서 별도 운영자 등록 화면은 만들지 않는다.

**테이블별 RLS 정책:**

| 테이블 | 작업 | member | admin | 비고 |
|--------|------|--------|-------|------|
| profiles | SELECT | 자기 레코드만 | 전체 | `auth.uid() = id` |
| profiles | UPDATE | 자기 레코드만 | 자기 레코드만 | 닉네임 변경 등 |
| meetings | SELECT | 전체 (active만 필터는 프론트에서) | 전체 | 공개 데이터 |
| meetings | INSERT/UPDATE/DELETE | 불가 | 허용 | admin만 모임 관리 |
| registrations | SELECT | 자기 레코드만 | 전체 | `auth.uid() = user_id` |
| registrations | INSERT | — | — | API Route(service_role)에서만 INSERT. 프론트에서 직접 INSERT 불가 |
| registrations | UPDATE | — | — | API Route(service_role)에서만 UPDATE. 취소/환불 처리 |

> **registrations COUNT 문제와 해결:** 회원의 RLS는 `auth.uid() = user_id`이므로 자기 레코드만 조회 가능하다. 그런데 모임 목록에서 "남은 자리"를 계산하려면 **해당 모임의 전체 confirmed 신청 수**가 필요하다. 이를 해결하기 위해 **DB Function(RPC)**을 사용한다. `SECURITY DEFINER` 함수는 RLS를 우회하여 전체 registrations를 카운트할 수 있다. 모임 목록 조회 시 이 함수를 호출하여 모임별 confirmed 수를 반환받는다. 또는 meetings 테이블에 confirmed_count 캐시 컬럼을 두고 Trigger로 동기화하는 방법도 가능하다.

### 2-4. 구조 검증

**이 구조가 최선인 이유**: 프론트엔드, API, 배포가 하나의 Next.js 프로젝트. AI 에이전트가 단일 코드베이스에서 작업 가능. 관리 포인트 최소화.

**시너지**: Supabase RLS로 DB 레벨 접근 제어 → API 코드에서 권한 체크 중복 감소. Vercel + Next.js 자동 배포 → 코드 수정 후 즉시 반영.

**잠재적 위험성**:
- Vercel Serverless Cold Start — 250명 규모에서는 체감 없음
- 결제 Webhook 실패 시 결제됐는데 신청 안 됨 → 서버 사이드 결제 검증으로 해결 (아래 데이터 흐름 참조)

**추후 기능 중 이 구조에서 제약이 있는 것**: 알림톡/리마인드 예약 발송 — Vercel Serverless는 상시 구동이 아님. Supabase Edge Functions 또는 Vercel Cron으로 해결 가능하며, 현재 MVP 구조 변경 불필요.

---

## 3. 유저 흐름 구조

### 3-1. 회원 흐름

**흐름 1: 첫 접속 (카카오 로그인)**

```
카톡방에서 링크 클릭
→ 로그인 화면 (카카오 로그인 버튼)
→ 카카오 인증
→ 모임 일정 목록 (메인 화면)
```

재방문 시 로그인 유지, 바로 모임 일정 목록 진입.

> **목록 범위**: 회원에게는 오늘(포함) 이후 active 상태 모임만 표시. deleting/deleted 상태 모임은 표시하지 않는다.

**흐름 2: 모임 신청 + 결제 (핵심 흐름)**

```
모임 일정 목록 (내가 신청한 모임은 "신청완료" 표시, 마감 모임은 "마감" 뱃지)
→ 모임 카드 터치 (1클릭)
→ 모임 상세 (날짜, 시간, 장소, 남은 자리, 참가비)
→ "신청하기" 버튼 (2클릭)
→ 포트원 결제창 진입 (3클릭)
→ 결제 완료
→ 신청 확정 화면 ("신청이 완료되었습니다" + 모임 정보 요약)
→ 모임 일정 목록으로 돌아감 (해당 모임에 "신청완료" 표시)
```

> 3클릭 규칙: 결제 화면 진입까지 3클릭. PG사 결제창 내 클릭은 제외.

**분기 — 정원 마감:**

```
모임 일정 목록 ("마감" 뱃지)
→ 모임 카드 터치
→ 모임 상세 ("마감" 표시 + 신청하기 버튼 비활성화)
→ 더 이상 진행 불가
```

**흐름 3: 내 신청 내역 확인**

```
하단 탭 "내 신청" 터치
→ 내 신청 목록 (신청한 모임들 + 각각 상태: 신청완료/취소됨/참여 완료)
```

> 과거 모임 이력도 포함된다. 모임 날짜가 지난 신청완료 건은 "참여 완료", 취소 건은 "취소됨"으로 표시. 정렬: 날짜 내림차순 (최근 신청이 맨 위).

**흐름 4: 취소 + 환불**

```
내 신청 목록
→ 취소할 모임 터치
→ 모임 상세 (신청한 상태로 표시)
→ "취소하기" 버튼
→ 환불 규정 안내 표시
   - 3일 전: "환불 예정 금액: 10,000원 (100%)"
   - 2일 전: "환불 예정 금액: 5,000원 (50%)"
   - 이후: "환불 금액: 0원 (환불 불가 기간)"
   + "문의가 필요하시면 단무지에게 1대1톡으로 연락해주세요" 안내
→ "취소를 확정하시겠습니까?" 최종 확인
→ 확정
→ 취소 완료 화면 (환불 예정 금액 + 환불 소요 시간 안내)
```

> 환불 불가 기간에도 취소 자체는 가능. "환불 금액: 0원"을 명확히 표시.
> 모임 날짜 다음 날부터는 취소 불가 (취소하기 버튼 미표시).
> 취소 후 자리가 남아있으면 재신청 가능 (새 결제 진행).

**결제 실패 시:**

```
결제 실패 (사용자 취소, 한도 초과, 오류 등)
→ 모임 상세 페이지로 복귀
→ "결제가 완료되지 않았습니다. 다시 시도해주세요." 토스트 메시지
→ 신청은 확정되지 않음, 바로 재시도 가능
```

**모임 상세 페이지 버튼 분기:**

버튼은 "현재 confirmed 신청 유무"와 "모임 시점"으로만 결정한다. cancelled 레코드만 있으면 미신청과 동일 (재신청 자연스럽게 가능). "취소됨" 표시는 내 신청 목록에서만.

| 조건 | 표시 |
|------|------|
| 모임 전 + confirmed 없음 + 자리 있음 | "신청하기" 버튼 (활성) |
| 모임 전 + confirmed 없음 + 마감 | "마감" (비활성) |
| 모임 당일 이전(포함) + confirmed 있음 | "취소하기" 버튼 (활성) |
| 모임 지남 + confirmed 있음 | "참여 완료" 텍스트, 버튼 없음 |
| 모임 지남 + confirmed 없음 | 버튼 없음 |

### 3-2. 운영자 흐름

> 운영자의 모임 일정 목록에는 과거 모임과 deleting 상태 모임도 표시된다 (정산 확인, 환불 실패 건 재처리 등을 위해). **deleted(삭제 완료) 모임은 표시하지 않는다** — 더 이상 조치할 게 없는 상태이므로 목록에서 제외한다.

**흐름 5: 모임 생성**

```
운영자 메뉴 → "모임 만들기"
→ 모임 정보 입력 (모임명, 날짜, 시간, 장소, 정원, 참가비)
→ "등록" 버튼
→ 모임 일정 목록에 바로 반영
```

**흐름 6: 모임 수정**

```
모임 일정 목록 → 모임 선택
→ 모임 상세 (운영자에게는 "수정" 버튼 노출)
→ 정보 수정 → "저장"
```

**흐름 7: 모임 삭제**

```
모임 상세 → "삭제" 버튼
→ 경고: "신청자 N명에게 전액 환불됩니다. 삭제하시겠습니까?"
→ "확정" 버튼
→ 일괄 환불 처리 → 전원 성공 시 삭제 완료
→ 실패 건 있으면: meetings.status = deleting 유지, "N건 환불 실패" 알림
```

**흐름 7-1: 환불 실패 건 재시도**

```
운영자 모임 일정 목록 (deleting 상태 모임이 "환불 미처리" 표시와 함께 보임)
→ deleting 모임 터치
→ 모임 상세 (신청자 목록에서 환불 실패 건 = confirmed 상태로 표시)
→ "환불 재시도" 버튼
→ 미처리 건 순차 환불 재시도
→ 전원 성공: meetings.status → deleted, 목록에서 사라짐
→ 여전히 실패 건 있으면: deleting 유지, 재시도 반복 가능
```

**흐름 8: 신청자 목록 확인 (운영자 전용)**

```
모임 상세 → 하단에 신청자 목록 (운영자에게만 표시)
→ 각 신청자: 이름, 결제 상태(결제완료/취소됨), 결제 일시
```

### 3-3. 화면 구성 요약

**회원 화면** (6개): 로그인, 모임 일정 목록(메인), 모임 상세, 신청 확정, 내 신청 목록, 취소 완료

**운영자 추가 화면** (1~2개): 모임 생성/수정 폼 (모임 상세에 수정/삭제 버튼 추가, 신청자 목록은 상세 내 표시)

**공통 요소**: 하단 탭 (모임 일정 / 내 신청)

---

## 4. 데이터 흐름 구조

### 4-1. 데이터 저장 구조

```
profiles (사용자 프로필)
├ id (UUID — auth.users.id를 PK이자 FK로 사용, NOT NULL)
├ kakao_id (TEXT, NULLABLE — Supabase Auth raw_user_meta_data에서 추출, 카카오가 미제공 시 null)
├ nickname (TEXT, NOT NULL, DEFAULT '' — 카카오 닉네임. 미제공 시 빈 문자열)
├ email (TEXT, NULLABLE — 카카오 이메일. 사용자가 이메일 제공에 동의하지 않으면 null)
├ role (TEXT, NOT NULL, DEFAULT 'member' — member / admin)
├ created_at (TIMESTAMPTZ, NOT NULL, DEFAULT now())

meetings (모임)
├ id (UUID)
├ title (모임명)
├ date (모임 날짜 — DATE 타입)
├ time (모임 시간 — TIME 타입, 시작 시간만 저장. 예: '19:00'. 추후 리마인드 기능 시 date + time → TIMESTAMPTZ 변환 필요)
├ location (장소)
├ capacity (정원)
├ fee (참가비 — 모임별 가변)
├ status (active / deleting / deleted)
├ created_at
├ updated_at

registrations (신청)
├ id (UUID)
├ user_id → profiles.id (FK)
├ meeting_id → meetings.id (FK)
├ status (confirmed / cancelled)
├ cancel_type (null / user_cancelled / meeting_deleted)
├ payment_id (포트원 결제 ID)
├ paid_amount (실제 결제 금액)
├ refunded_amount (환불 금액)
├ attended (참석 여부 — null, MVP에서 미사용, 추후 참석 확인용)
├ created_at
├ cancelled_at
```

**Supabase Auth 연동 패턴:**
- Supabase Auth가 `auth.users` 테이블을 자동 관리한다. 우리가 직접 건드리지 않는다.
- `profiles`는 `auth.users.id`를 PK이자 FK로 참조하는 public 테이블이다.
- 카카오 로그인 시 `auth.users`에 레코드가 생기면, **DB Trigger**로 `profiles`에 자동 INSERT한다 (Supabase 표준 패턴).
- RLS 정책은 `auth.uid()`로 현재 로그인 사용자를 식별한다.

**DB 접근 방식 (프론트 vs API Route):**
- **프론트엔드 (Supabase Client)**: anon key + 사용자 JWT 토큰으로 접근. RLS가 적용되어 사용자별 데이터만 조회 가능.
- **API Route (Supabase Admin Client)**: service_role key로 접근. RLS를 우회한다. 따라서 결제 검증, 정원 체크, 환불 처리 등 **비즈니스 로직 검증은 API Route 코드 안에서 반드시 수행**해야 한다. service_role key는 절대 프론트엔드에 노출하지 않는다.

### 4-2. 핵심 데이터 흐름

**흐름 1: 모임 일정 목록 조회**

```
회원이 목록 화면 접속
→ [Supabase] 단일 조회:
   meetings (status = active AND date >= 오늘)
   + registrations에서 모임별 confirmed 신청 수 COUNT (남은 자리 계산, 마감 판단)
   + registrations에서 현재 사용자의 confirmed 신청 존재 여부 (신청완료 뱃지. cancelled 레코드는 무시)
→ [프론트엔드] 각 모임 카드에 남은 자리 / 마감 뱃지 / 신청완료 표시
→ 정렬: 날짜 오름차순 (가장 가까운 모임이 맨 위)
```

> 운영자의 목록 조회는 date 필터 없이 전체 모임 조회. status = active 또는 deleting만 포함 (deleted 제외). deleting 상태 모임은 "환불 미처리" 표시. 정렬: 날짜 내림차순 (최근 모임이 맨 위).

**흐름 2: 모임 신청 + 결제**

```
① 회원이 "신청하기" 클릭
→ [프론트엔드] 포트원 SDK 호출 → PG사 결제창 표시

② 회원이 결제 완료
→ [포트원] 결제 결과를 프론트엔드 콜백으로 전달 (결제 ID 포함)

③ 프론트엔드가 API Route 호출 ("이 결제를 검증해줘")
→ [API Route] 포트원 REST API로 결제 검증 요청
→ [포트원] 결제 정보 응답 (금액, 상태 확인)

④ API Route가 검증 완료 후 정원 체크
→ [API Route] Supabase DB에서 원자적으로 확인:
   "현재 confirmed 신청 수 < capacity"
→ 정원 OK:
   registrations에 INSERT (status: confirmed, payment_id, paid_amount 저장)
   → 프론트에 성공 응답
→ 정원 초과:
   포트원 환불 API 호출 (전액 환불)
   → 프론트에 "마감" 응답
```

> **핵심 규칙**: 프론트엔드의 "결제됐다"는 말을 그대로 믿지 않는다. 서버가 포트원에 직접 결제 검증을 한다.
> **동시 신청 처리**: 정원 체크는 DB 트랜잭션 레벨에서 원자적으로 수행한다. 두 명이 동시에 마지막 1자리를 신청하면, 먼저 INSERT된 건만 성공하고 나머지는 환불 처리된다.

**정원 체크 원자성 구현 방법:**

API Route에서 SELECT COUNT → if문 → INSERT를 순차 실행하면 race condition이 발생한다. 반드시 **Supabase DB Function(RPC)**으로 정원 체크와 INSERT를 하나의 트랜잭션 안에서 처리한다.

```
DB Function: confirm_registration(p_user_id, p_meeting_id, p_payment_id, p_paid_amount)

1. SELECT ... FROM meetings WHERE id = p_meeting_id FOR UPDATE
   → 해당 모임 행에 row-level lock 획득 (다른 트랜잭션은 대기)
2. SELECT COUNT(*) FROM registrations WHERE meeting_id = p_meeting_id AND status = 'confirmed'
3. IF count < capacity:
     INSERT INTO registrations (status: 'confirmed', ...)
     RETURN 'success'
   ELSE:
     RETURN 'full' (정원 초과 — 호출한 API Route에서 환불 처리)
```

API Route는 이 함수의 반환값에 따라 성공 응답 또는 환불 처리를 진행한다.

> **정원 초과 환불 실패 시**: 환불 API 호출이 실패하면, 에러를 로그에 기록하고 프론트에 "일시적 오류가 발생했습니다. 잠시 후 다시 시도해주세요." 안내 메시지를 반환한다. 결제 건은 포트원 관리자 콘솔에서 운영자가 수동 확인 후 처리한다.

**흐름 3: 취소 + 환불**

```
① 회원이 "취소 확정" 클릭
→ [프론트엔드] API Route 호출

② API Route 처리
→ [API Route] 환불 금액 계산 (아래 의사코드 참조)
→ [API Route] 포트원 환불 API 호출 (전액 또는 부분 환불, 0원이면 호출 생략)

③ 환불 성공 (또는 0원 환불인 경우)
→ [Supabase DB] registrations 업데이트:
   status → cancelled
   cancel_type → user_cancelled
   refunded_amount → 계산된 금액
   cancelled_at → 현재 시각
→ [프론트엔드] 취소 완료 화면 표시
```

**환불 금액 계산 의사코드 (KST 기준, 날짜 단위):**

```
today = 현재 날짜 (KST)
days_remaining = meeting.date - today

if days_remaining >= 3:
    refund_rate = 100%    // 3일 전 이상
elif days_remaining >= 2:
    refund_rate = 50%     // 2일 전
else:
    refund_rate = 0%      // 1일 전, 당일 포함

refund_amount = paid_amount × refund_rate
```

> **환불 기준 시점**: 날짜 단위로 계산한다. 모임 날짜가 3월 5일이면, 3월 2일 23:59까지 취소 = 3일 전 (100% 환불). 3월 3일 00:00부터 = 2일 전 (50% 환불).

**흐름 4: 모임 삭제 + 일괄 환불**

```
① 운영자가 삭제 확정
→ [Supabase DB] meetings.status → deleting (새 신청 차단)

② 해당 모임의 confirmed 신청자 전원에 대해 **병렬** 환불 (Promise.allSettled)
→ 각 건: 포트원 환불 API 호출 (100% 환불)

> **병렬 처리 필수**: Vercel Hobby 플랜의 Serverless Function 실행 시간 제한은 10초다. 포트원 API 응답이 건당 1~3초이므로, 14명을 순차 처리하면 타임아웃된다. Promise.allSettled로 병렬 호출하면 전원 처리가 3초 내에 완료되고, 개별 실패도 격리된다.
→ 성공 시:
   registrations.status → cancelled
   cancel_type → meeting_deleted
   refunded_amount → paid_amount (전액)
→ 실패 시:
   registrations.status는 confirmed 유지 (실제로 환불이 안 됐으므로)
   재시도 대기

③ 전체 완료 확인
→ 전원 환불 성공: meetings.status → deleted
→ 실패 건 있음: meetings.status는 deleting 유지, 운영자에게 화면 알림 (재시도 필요)
→ "deleting 상태 모임에 confirmed 신청이 남아있음 = 환불 미처리 건"으로 판단
```

> **부분 실패 대응**: 한번에 삭제하지 않고 deleting 상태를 거친다. 환불 실패 건이 있으면 운영자에게 알리고, 재시도할 수 있게 한다.

**흐름 5: 모임 수정**

```
운영자가 모임 정보 수정
→ [Supabase DB] meetings 테이블 UPDATE
```

> **규칙**: 모임 수정 시 기존 registrations의 paid_amount는 변경하지 않는다. 참가비가 10,000원 → 15,000원으로 바뀌어도, 기존 결제 건은 10,000원 유지.

### 4-3. 데이터 규칙 요약

| 규칙 | 설명 |
|------|------|
| 타임존 기준 | 모든 날짜 계산(환불, 목록 필터, 취소 가능 여부)은 Asia/Seoul(KST) 기준이다. Vercel Serverless 기본 UTC와 다르므로 반드시 KST 변환 후 비교할 것 |
| 결제 없이 신청 없음 | registrations는 결제 완료 후에만 INSERT |
| 정원 체크는 DB 레벨 | 트랜잭션으로 원자적 체크, 동시 신청 방어 |
| 결제 검증은 서버에서 | 프론트엔드가 아닌 API Route에서 포트원에 검증 |
| 환불 계산은 날짜 단위 | 모임 date - 취소 날짜, 시간 무관 |
| 모임 수정 ≠ 기존 결제 변경 | paid_amount는 결제 시점에 확정, 이후 불변 |
| 삭제는 deleting 경유 | 환불 완료 전까지 deleted로 바꾸지 않음 |
| 일괄 환불은 병렬 처리 | Promise.allSettled로 병렬 호출. Vercel 10초 타임아웃 방지 |
| API Route는 service_role key | RLS 우회하되 비즈니스 로직 검증은 코드에서 수행. anon key는 프론트 전용 |
| 환불 실패 판단 | deleting 상태 모임에 confirmed 신청이 남아있으면 환불 미처리 건 |
| 취소 기한 | 모임 당일까지 취소 가능, 다음 날부터 취소 불가 |
| 재신청 가능 | 취소 후 자리 남아있으면 새 registrations 레코드로 재신청 |
| user_id + meeting_id는 UNIQUE가 아니다 | 재신청 시 cancelled + confirmed 복수 레코드 가능. UNIQUE 제약 걸지 말 것 |
| 신청 여부 판단은 confirmed만 | 목록 뱃지, 상세 버튼, 정원 카운트 모두 status = confirmed인 레코드만 기준. cancelled는 무시 |
| 참여 이력 데이터 축적 | attended 필드로 추후 참석 확인 대비 (MVP 미사용) |
| 운영자 식별 | Supabase 대시보드에서 수동 admin 설정, 별도 등록 화면 없음 |

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| v1.0 | 2025-02-26 | 최초 작성: 기술 스택 확정, 시스템 구조, 유저 흐름, 데이터 흐름 |
| v1.1 | 2025-02-26 | 13건 검토 반영: 모임 삭제 항상 API Route, 목록 범위(회원:오늘이후/운영자:전체), 결제 실패 처리, 버튼 6가지 분기, 취소 기한, 재신청 가능, 환불 실패 판단 방식, 운영자 식별, 신청자 목록 운영자 전용 |
| v1.2 | 2025-02-26 | 버튼 분기 5가지로 재정리(confirmed 기준), user_id+meeting_id UNIQUE 불가 명시, 신청 여부 판단 confirmed만 체크 명시 |
| v1.3 | 2025-02-26 | 환불 실패 재시도 흐름 추가(흐름 7-1), 운영자 목록에서 deleted 제외 명시 |
| v1.4 | 2025-02-26 | 배포환경 검토 5건: 타임존 KST 명시, profiles+Auth 패턴 명시, 목록 정렬 순서, 일괄 환불 병렬 처리(Vercel 10초 제한 대응), API Route service_role key 명시 |
| v1.5 | 2025-02-28 | AI 에이전트 구현 안전성 5건: 정원 체크 DB Function(RPC) 구현 방법 명시, 테이블별 RLS 정책 요약표 + registrations COUNT 해결 방안, meetings.time TIME 타입 명시, profiles 컬럼 nullable/기본값 정의, 환불 계산 의사코드 추가, 정원 초과 환불 실패 시 대응 추가 |
