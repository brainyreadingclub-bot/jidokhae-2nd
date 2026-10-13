// 운영자 모임 상세(토론) 그리기 — origin/main AdminMeetingOverview + AdminMeetingSection 구조 그대로.
// 이름은 전부 가짜. 금액은 숫자만. 상태는 주소 끝 #이름 으로 바꾼다 (각 HTML의 window.STATES).
;(function () {
  var FEE = '25,000'
  function P(nick, real, status, method, date, extra) {
    var o = { nick: nick, real: real, status: status, method: method, date: date }
    for (var k in extra || {}) o[k] = extra[k]
    return o
  }
  var base = [
    P('밑줄긋기', '박서연', 'confirmed', 'card', '10/6'),
    P('새벽책장', '이도윤', 'confirmed', 'transfer', '10/4'),
    P('모서리', '정유나', 'pending', 'transfer', '10/3'),
  ]
  var fullTen = [
    P('첫문장', '배수아', 'confirmed', 'card', '10/12'),
    P('여백', '문가온', 'confirmed', 'card', '10/11'),
    P('연필깎이', '장도현', 'confirmed', 'transfer', '10/10'),
    P('북극곰', '서지안', 'confirmed', 'card', '10/9'),
    P('활자중독', '윤태오', 'confirmed', 'card', '10/8'),
    P('느린산책', '오세린', 'confirmed', 'card', '10/7'),
    P('밑줄긋기', '박서연', 'confirmed', 'card', '10/6'),
    P('새벽책장', '이도윤', 'confirmed', 'transfer', '10/4'),
    P('모서리', '정유나', 'pending', 'transfer', '10/3'),
  ]
  var wait = [
    P('책먹는여우', '최민준', 'waitlisted', 'card', '10/12'),
    P('오후세시', '한지우', 'waitlisted', 'card', '10/13'),
  ]
  var PAGES = {
    none: { pres: 'none', regs: base, cap: 10 },
    set: { pres: 'set', presName: ['초록고래', '김하늘'], regs: [P('초록고래', '김하늘', 'presenter', null, '10/13')].concat(base), cap: 10 },
    converted: {
      pres: 'set', presName: ['새벽책장', '이도윤'], cap: 10,
      regs: [
        P('새벽책장', '이도윤', 'presenter', null, '10/13'),
        P('밑줄긋기', '박서연', 'confirmed', 'card', '10/6'),
        P('새벽책장', '이도윤', 'cancelled', 'transfer', '10/4', { conv: true }),
        P('모서리', '정유나', 'pending', 'transfer', '10/3'),
      ],
    },
    full: { pres: 'full', regs: [P('초록고래', '김하늘', 'confirmed', 'card', '10/12')].concat(fullTen), wait: wait, cap: 10 },
    fullSet: { pres: 'set', presName: ['초록고래', '김하늘'], regs: [P('초록고래', '김하늘', 'presenter', null, '10/13')].concat(fullTen), wait: wait, cap: 10 },
  }

  var chev = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>'
  var boxOn = '<svg class="chk" viewBox="0 0 24 24" fill="none"><rect x="2" y="2" width="20" height="20" rx="4" fill="#F4552A"/><path d="M7 12.5l3.5 3.5 6.5-7" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  var boxOff = '<svg class="chk" viewBox="0 0 24 24" fill="none"><rect x="2" y="2" width="20" height="20" rx="4" stroke="#F79B7C" stroke-width="2" fill="none"/></svg>'

  function seated(r) { return r.status === 'confirmed' || r.status === 'pending' || r.status === 'presenter' }
  function badge(r) {
    if (r.status === 'presenter') return '<span class="badge pres">발제자</span>'
    if (r.status === 'pending') return '<span class="badge pend">입금 대기</span>'
    if (r.status === 'confirmed') return '<span class="badge ok">결제완료</span>'
    if (r.status === 'waitlisted') return '<span class="badge pend">대기 중</span>'
    return '<span class="badge off">취소됨</span>'
  }
  function pm(r) { return r.method === 'transfer' ? '<span class="pm">이체</span>' : r.method === 'card' ? '<span class="pm">카드</span>' : '' }
  function nm(r) { return r.real + ' (' + r.nick + ')' }

  function presCard(pg) {
    if (pg.pres === 'set') {
      return '<div class="stat pres row"><div class="pl"><div class="l">발제자</div>' +
        '<div class="pv">' + pg.presName[0] + '<small>' + pg.presName[1] + '</small></div>' +
        '<p class="s">참가비 없이 신청 완료 · 회원 화면에는 발제자로 안 보여요</p></div>' +
        '<a class="btn line lg" href="#remove">빼기</a></div>'
    }
    if (pg.pres === 'full') {
      return '<div class="stat pres"><div class="pl"><div class="l">발제자</div>' +
        '<div class="pv none">지정 안 함</div>' +
        '<p class="s block">정원이 찼어요. 정원을 늘리거나 자리가 나면 지정하세요</p>' +
        '<a class="alt" href="#pickfull">이미 신청한 분 중에서 고르기</a></div>' +
        '<span class="btn primary lg off">발제자 지정</span></div>'
    }
    return '<div class="stat pres"><div class="pl"><div class="l">발제자</div>' +
      '<div class="pv none">지정 안 함</div>' +
      '<p class="s">정하면 참가비 없이 신청 완료로 정원 한 자리를 차지해요. 안 정해도 돼요</p></div>' +
      '<a class="btn line lg" href="#pick">발제자 지정</a></div>'
  }

  function amountSub(r) {
    if (r.status === 'presenter') return ''
    if (r.status === 'pending') return '<div class="amt p">' + FEE + ' (입금 대기)</div>'
    if (r.status === 'confirmed' || r.status === 'waitlisted') return '<div class="amt">' + FEE + '</div>'
    if (r.conv) return '<div class="amt c">환불 필요</div><div class="amt g">환불 ' + FEE + '</div><div class="amt g">(발제자로 바꿈)</div><div class="amt g">010-0000-0000</div><div class="amt g">10/13</div>'
    return ''
  }

  function list(regs, queue) {
    var cards = regs.map(function (r, i) {
      var tog = ''
      if (r.status === 'pending') tog = boxOff
      else if (r.status === 'confirmed' && r.method === 'transfer') tog = boxOn
      else if (r.conv) tog = boxOff
      var line = r.date + (r.status !== 'presenter' && r.status !== 'cancelled' ? '<span style="color:rgba(18,122,90,.7)"> · ' + FEE + '</span>' : '')
      if (r.status === 'presenter') line = r.date + ' 지정'
      if (r.conv) line = r.date + ' · ' + FEE + '<span class="x">' + ['환불 필요', '환불 ' + FEE, '(발제자로 바꿈)', '010-0000-0000', '10/13'].map(function (t) { return '<span style="white-space:nowrap;margin-right:6px">' + t + '</span>' }).join('') + '</span>'
      return '<div class="mcard"><div class="r1"><div class="nm">' + (queue ? '<span style="font-size:12px;font-weight:700;color:var(--a500);margin-right:6px">#' + (i + 1) + '</span>' : '') + nm(r) + '</div>' +
        '<div class="bd">' + badge(r) + pm(r) + '</div></div>' +
        '<div class="r2"><div class="t">' + line + '</div>' + tog + '</div></div>'
    }).join('')
    var rows = regs.map(function (r, i) {
      var tog = ''
      if (r.status === 'pending') tog = boxOff
      else if (r.status === 'confirmed' && r.method === 'transfer') tog = boxOn
      return '<tr>' + (queue ? '<td class="c" style="font-size:12px;font-weight:700;color:var(--a500)">' + (i + 1) + '</td>' : '') +
        '<td class="nm">' + nm(r) + '</td><td class="dt">' + r.date + '</td>' +
        '<td class="r"><div class="st"><div class="row">' + badge(r) + pm(r) + '</div>' + tog + amountSub(r) + '</div></td></tr>'
    }).join('')
    return '<div class="mcards">' + cards + '</div>' +
      '<div class="tblwrap"><table class="tbl"><thead><tr>' + (queue ? '<th class="c">#</th>' : '') +
      '<th>이름</th><th>신청일</th><th class="r">상태</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
  }

  function page(key) {
    var pg = PAGES[key]
    var regs = pg.regs
    var cnt = regs.filter(seated).length
    var cancelled = regs.filter(function (r) { return r.status === 'cancelled' }).length
    var hasPres = regs.some(function (r) { return r.status === 'presenter' })
    var remain = Math.max(0, pg.cap - cnt)
    var wcount = (pg.wait || []).length
    var paidRegs = regs.filter(function (r) { return r.status === 'confirmed' || r.status === 'cancelled' }).length
    var total = (paidRegs * 25000).toLocaleString('en-US')
    var refundable = regs.filter(function (r) { return r.status === 'confirmed' }).length + (pg.wait || []).length
    return '' +
      '<div class="topline"><a class="crumb">' + chev + '모임 관리</a>' +
      '<div class="acts"><a class="btn line sm">회원 화면 보기</a><a class="btn line sm">수정</a></div></div>' +
      '<div class="pills"><span class="pill region">포항</span><span class="pill type">토론</span></div>' +
      '<h1 class="h1">실연당한 사람들을 위한 일곱 시 조찬모임</h1>' +
      '<div class="info"><span style="flex:none">10월 27일 (화) 오후 7:00</span><span class="dot">·</span><span class="place">공간 지그시 1711호</span><span class="dot">·</span><span style="flex:none">참가비 ' + FEE + '</span></div>' +
      '<div class="stats">' +
      '<div class="stat"><div class="l">발제문</div><div class="big">없음</div>' +
      '<p class="s">써서 「발제 공개하기」를 누르면 신청자 ' + cnt + '명에게 알림이 한 번 가요</p>' +
      '<a class="btn primary bigbtn">발제문 등록하기</a></div>' +
      '<div class="stat"><div class="l">신청</div><div class="big">' + cnt + '<small>/' + pg.cap + '</small></div>' +
      '<p class="s"><b>' + (remain > 0 ? '남은 ' + remain + '자리' : '정원 마감') + '</b> · 대기 ' + wcount + '명</p>' +
      '<div class="cap-bar"><i style="width:' + Math.min(100, cnt / pg.cap * 100) + '%"></i></div></div>' +
      presCard(pg) +
      '</div>' +
      '<div class="sec"><div class="sec-h"><h2>신청자<span>' + cnt + '명' + (hasPres ? ' · 발제자 포함' : '') + (cancelled ? ' · 취소 ' + cancelled + '명' : '') + '</span></h2><small>최근 신청 순</small></div>' +
      list(regs, false) +
      '<p class="sum">총 결제 <b>' + total + '</b><span class="sep">·</span>환불 <b>0</b><span class="sep">·</span>순매출 <b>' + total + '</b></p></div>' +
      (pg.wait ? '<h3 class="wl-h">대기자 목록 (' + wcount + '명)</h3>' + list(pg.wait, true) : '') +
      '<div class="danger"><div><b>모임 삭제</b><p>신청자 ' + refundable + '명에게 참가비가 전액 환불되고, 되돌릴 수 없어요.</p></div><a class="btn del-line">모임 삭제</a></div>'
  }

  function render() {
    var S = window.STATES
    var key = (location.hash || '#' + window.DEFAULT_STATE).slice(1)
    var st = S[key] || S[window.DEFAULT_STATE]
    document.getElementById('memo').innerHTML = st.memo || ''
    document.getElementById('memo').style.display = st.memo ? '' : 'none'
    document.getElementById('app').innerHTML = st.html ? st.html : page(st.page)
    document.getElementById('sheet').innerHTML = st.sheet ? '<div class="sdim"><div class="sheet' + (st.pick ? ' pick' : '') + '"><div class="grab"></div>' + st.sheet + '</div></div>' : ''
  }
  window.renderPage = page
  window.addEventListener('hashchange', render)
  document.addEventListener('DOMContentLoaded', render)
  if (document.readyState !== 'loading') render()
})()
