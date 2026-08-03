# 교훈: 로컬 프리뷰 전에 인증 요구사항 확인

**날짜:** 2026-03-27
**상황:** CalendarStrip 수정 후 로컬 dev 서버로 확인하려 했으나, `(main)` 라우트 그룹은 카카오 OAuth 필수. dev 서버 띄우기 4회 시도 후에야 "로그인 없이 도달 불가"라는 결론에 도달. 시간 낭비.

**규칙:**
- 로컬 프리뷰 전에 먼저 확인: "이 페이지가 `(main)` 라우트 그룹인가?" → 맞으면 로컬 확인 불가 (카카오 OAuth redirect는 localhost에서 동작하지 않음)
- `(main)` 페이지 변경은 Vercel 프로덕션/프리뷰에서 확인하거나, 사용자에게 직접 확인 요청
- `policy/*` 페이지나 `auth/*` 페이지는 로컬에서 확인 가능

**보완 (2026-08-03):** "로컬 확인 불가"는 **렌더된 화면**에 한정된다. **미들웨어 층은 로컬 curl로 검증 가능하다** — 미들웨어는 인증 판정 *전에* 돌고, 리다이렉트 응답(상태코드·`location`·`set-cookie`)이 곧 관측 대상이기 때문이다. 실제로 딥링크 복귀 기능을 이렇게 6케이스 검증했다:

```bash
npm run dev
curl -s -i http://localhost:3000/my | grep -iE "^HTTP|^location|^set-cookie"
curl -s -i -X POST http://localhost:3000/api/library/ask   # 가드 동작 확인
curl -s -i http://localhost:3000/my -H "Sec-Purpose: prefetch"
```

즉 **"카카오 OAuth 왕복이 필요한 부분"과 "그 앞단"을 나눠서** 판단할 것. 앞단까지 로컬에서 잡아두면 사용자에게 부탁할 수동 검증이 최소 케이스로 줄어든다.
