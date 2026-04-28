# 검토문서 인덱스

이 디렉토리에는 구현 후 참조용 spec, 운영 가이드, 의사결정 기록, 재사용 가능한 검증 템플릿이 모인다. 일자별 작업 회고나 단발성 검토 지시서는 핵심 교훈을 `memory/feedback_*` 또는 `CLAUDE.md`에 흡수한 후 폐기하는 것이 원칙.

## 📋 Specs (구현된 기능의 설계서, 디버깅·확장 시 참조)

- `Phase-2-2-대기신청-설계서.md` — 대기 신청 B안(미리 결제 → 승격 자동 확정 → 미승격 자동 환불) 설계
- `Phase-2-3-백오피스-지시서.md` — 백오피스 8개 작업 분해 + 시니어 검토 반영 이력 부록 (v1.3, 2026-04-28에 검토의견 흡수)

## 🛠️ Templates (재사용 가능한 검증/배포 절차)

- `M6-통합테스트-체크리스트.md` — 12 STEP 통합 테스트 패턴 + 모임 5개 생성 시나리오. **M12 통합 검증 시 패턴 참조**
- `M6-프로덕션-배포-가이드.md` — Supabase RLS/Functions 확인 + 토스 라이브 키 전환 절차. **M12 배포 시 절차 참조**

## 📜 Decisions (의사결정 기록, ADR-style)

- `2026-04-23-풀스캔-후속-의사결정.md` — 4/22~4/23 풀스캔 결과 재검토. 통신판매업 면제, GA4 동의 배너 불필요, 입금 확인 알림톡 금지, `admin_confirm_transfer` DB Function 추가. CLAUDE.md "Key Business Rules" + migration SQL이 직접 인용

## 🔧 Operations (운영 매뉴얼, 인시던트 대응)

- `2026-04-28-pwa-sw-운영-가이드.md` — Service Worker 캐시 전략 + 화면 이상 신고 5분 진단 + Kill Switch 절차

---

## 추가/이동 시 원칙

1. **신규 검토 산출물은 우선 이 디렉토리에**: `YYYY-MM-DD-설명.md` 또는 작업명-단계.md
2. **회고는 가능한 즉시 lesson만 추출하여 `memory/feedback_*`에 보존**: 회고 본문은 git history로 충분
3. **전문가 패널 토론 결과는 `docs/expert-panel/`로**: 검토문서는 작업 산출물 검토, expert-panel은 의사결정 배경
4. **마일스톤별 작업 지시서는 `roadmap/`으로**: 검토문서는 spec 보존, roadmap은 실행 계획
