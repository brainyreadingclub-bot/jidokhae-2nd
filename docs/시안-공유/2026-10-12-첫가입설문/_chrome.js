// 사이드바(데스크톱) + 모바일 헤더 — origin/main adminMenu.ts 순서 그대로(새 메뉴 없음). active = data-active
(function () {
  var active = document.body.getAttribute('data-active') || ''
  var groups = [
    ['운영', ['대시보드', '모임 관리', '정산', '회원 관리', '서재 응답률']],
    ['콘텐츠', ['배너 관리', '한 줄 관리', '공지 보내기']],
    ['시스템', ['알림톡 이력', '설정']],
  ]
  var nav = groups.map(function (g) {
    return '<div class="grp">' + g[0] + '</div>' + g[1].map(function (l) {
      return '<a class="it' + (l === active ? ' on' : '') + '">' + l + '</a>'
    }).join('')
  }).join('')
  var side = document.createElement('aside')
  side.className = 'side'
  side.innerHTML = '<div class="brand"><b>지독해</b><small>ADMIN</small></div><nav>' + nav + '</nav>'
  document.body.prepend(side)
  var mh = document.querySelector('.mhead')
  if (mh) mh.innerHTML = '<b>지독해</b><small>ADMIN</small>'
})()
