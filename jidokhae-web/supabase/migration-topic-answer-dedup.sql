-- 발제 답변 중복 저장 막기 (2026-10-13)
-- 대표님 결정: 한 발제에 여러 답변은 허용, 같은 사람이 같은 내용을 또 저장하는 것만 막는다.
-- 앱(api/topics/[id]/answers)이 먼저 같은 내용을 찾아 막고, 이 색인은 「동시에 두 요청」을 막는다.
-- 앱은 이 색인이 없어도 동작한다(배포 순서 무관). 충돌(23505)이 나면 있던 답변을 돌려준다.
-- 본문은 최대 2000자(한글 약 6000바이트)라 색인 한도를 넘으므로 md5로 건다.
-- 앱이 저장 전에 trim하므로 body 그대로 건다.

-- ① 먼저 이미 겹친 답변이 있는지 본다 — 0행이어야 ②가 성공한다
select topic_id, user_id, md5(body) as h, count(*) as n
from public.topic_answers
group by topic_id, user_id, md5(body)
having count(*) > 1;

-- ② 0행이면 실행한다 (표가 작아 잠깐이면 끝난다)
create unique index if not exists idx_topic_answers_no_dup
  on public.topic_answers (topic_id, user_id, md5(body));

-- 되돌리기: drop index if exists public.idx_topic_answers_no_dup;
