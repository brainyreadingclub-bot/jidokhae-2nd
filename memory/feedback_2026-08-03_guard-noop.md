---
name: 가드를 추가했으면 그 조건이 참이 되는 경로를 실측한다
description: prefetch 가드를 추가하고 "고쳤다"고 보고했으나 헤더가 미들웨어에 도달하지 않아 조용한 no-op이었음
type: feedback
---

조건부 가드(특정 요청·상태를 제외하는 분기)를 추가했으면, **그 조건이 실제로 참이 되는 경로를 한 번은 실측**한 뒤에 "고쳤다"고 말한다. 단위 테스트는 함수가 옳음을 증명할 뿐, **입력이 실제로 도착하는지는 증명하지 못한다.**

**Why:** 2026-08-03, 딥링크 복귀 기능에서 prefetch 요청을 제외하는 가드를 `request.headers.get('next-router-prefetch') !== null`로 작성했다. `shouldRememberPath` 단위 테스트는 전부 통과했고(입력 `true`를 주면 `false`를 반환하니 당연히), "prefetch 제외 수정 완료"로 보고했다. 그러나 Next.js는 `next-router-prefetch`와 `RSC`를 **미들웨어에 닿기 전에 제거**한다. 조건이 영원히 거짓이라 가드가 없는 것과 동일했다. 사용자가 재검증을 요청해서야 발견했다. 디버그 헤더로 미들웨어가 받는 헤더 전체를 찍어보니 `accept, host, purpose, sec-purpose, user-agent, x-forwarded-*` 뿐이었다.

**How to apply:**
- 헤더·쿠키·환경변수처럼 **런타임이 주는 입력**에 의존하는 분기를 만들면, 그 값이 실제로 도착하는지 한 번 찍어본다. `response.headers.set('x-debug-...', String(값))` 후 curl 한 줄이면 끝난다.
- 단위 테스트만 통과한 가드는 "구현했다"까지만 말하고 "동작한다"고 말하지 않는다.
- Next.js 미들웨어에서 prefetch 판별은 `sec-purpose`(표준) / `purpose`(구 크롬)로 한다. `next-router-prefetch`·`RSC`는 도달하지 않는다.
- 같은 함정 후보: `x-forwarded-*`, 커스텀 헤더, `request.ip`, 미들웨어에서의 `cookies()` — 전부 런타임이 걸러낼 수 있다.
