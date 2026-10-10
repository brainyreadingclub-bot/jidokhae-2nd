// 사이드바(데스크톱) + 모바일 헤더 — adminMenu.ts 순서 그대로. active = data-active
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
  if (mh) mh.innerHTML = '<span class="burger"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></svg></span><b>지독해</b><small>ADMIN</small>'
  // 상태 전환: 주소 끝 #state 를 body[data-state]로
  function sync() { document.body.setAttribute('data-state', (location.hash || '#' + (document.body.getAttribute('data-default') || '')).slice(1)) }
  sync(); window.addEventListener('hashchange', sync)
})()
