/* ============================================================
   Court VC Links — app logic (live data, config-driven render)
   ============================================================ */
(function () {
  'use strict';

  var COURTS = window.COURTS || [];
  var byId = window.CVC.byId;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var LS = {
    favs: 'cvc:favs', recents: 'cvc:recents',
    get: function (k) { try { return JSON.parse(localStorage.getItem(k)) || []; } catch (e) { return []; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  /* ---------- escaping ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }
  var escAttr = esc;
  var isHttp = function (v) { return /^https?:\/\//i.test(v || ''); };

  /* ---------- icons ---------- */
  var ICONS = {
    gavel: '<path d="M14 5 9 10m5-5 3 3-5 5-3-3zM7 12l5 5m-7-1 4 4M3 21h7"/>',
    building: '<path d="M4 21V8l8-5 8 5v13M4 21h16M9 21v-5h6v5M8 11h.01M12 11h.01M16 11h.01"/>',
    pillars: '<path d="M3 21h18M5 21V9m4 12V9m6 12V9m4 12V9M3 9h18L12 3 3 9z"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3zM9.5 12l2 2 3.5-4"/>',
    doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zm0 0v6h6M8 13h8M8 17h6"/>'
  };
  var copyIc = '<svg class="ic" viewBox="0 0 24 24" style="width:14px;height:14px"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';
  var videoIc = '<svg class="ic" viewBox="0 0 24 24" style="width:15px;height:15px"><path d="M15 10l5-3v10l-5-3M3 6h12v12H3z"/></svg>';

  /* ---------- views ---------- */
  var homeView = $('#homeView'), searchView = $('#searchView'),
      detailView = $('#detailView'), toolHead = $('#toolHead');
  var currentCourt = null;

  function showHome() {
    detailView.classList.add('hidden');
    searchView.classList.add('hidden');
    homeView.classList.remove('hidden');
    toolHead.classList.remove('hidden');
    currentCourt = null;
  }
  function showDetail() {
    homeView.classList.add('hidden');
    searchView.classList.add('hidden');
    detailView.classList.remove('hidden');
    toolHead.classList.add('hidden');
  }
  function showSearch() {
    homeView.classList.add('hidden');
    detailView.classList.add('hidden');
    searchView.classList.remove('hidden');
    toolHead.classList.add('hidden');
  }

  /* ---------- court grid ---------- */
  function courtCardHTML(c) {
    var favs = LS.get(LS.favs);
    var isFav = favs.indexOf(c.id) > -1;
    return '<button class="court-card" data-court="' + c.id + '">' +
      '<div class="topbar-row">' +
        '<div class="cicon"><svg class="ic" viewBox="0 0 24 24">' + (ICONS[c.icon] || ICONS.building) + '</svg></div>' +
        '<span class="fav ' + (isFav ? 'on' : '') + '" data-fav="' + c.id + '" role="button" aria-label="Toggle favorite">' +
          '<svg class="ic ' + (isFav ? 'ic-fill' : '') + '" viewBox="0 0 24 24"><path d="m12 2 3 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.9 21l1.2-6.8-5-4.9 6.9-1z"/></svg>' +
        '</span>' +
      '</div>' +
      '<div><h3>' + esc(c.name) + '</h3>' +
        '<div class="meta"><span class="pill">' + esc(c.region) + '</span></div></div>' +
      '<div class="go">Open links <svg class="ic" viewBox="0 0 24 24" style="font-size:15px"><path d="m9 18 6-6-6-6"/></svg></div>' +
    '</button>';
  }
  function renderGrid() {
    $('#courtGrid').innerHTML = COURTS.map(courtCardHTML).join('');
    renderChips();
  }

  function chip(c, isFav) {
    return '<button class="chip ' + (isFav ? 'star' : '') + '" data-court="' + c.id + '">' +
      (isFav
        ? '<svg class="ic ic-fill" viewBox="0 0 24 24"><path d="m12 2 3 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.9 21l1.2-6.8-5-4.9 6.9-1z"/></svg>'
        : '<svg class="ic" viewBox="0 0 24 24">' + (ICONS[c.icon] || ICONS.building) + '</svg>') +
      esc(c.short) + '</button>';
  }
  function renderChips() {
    var favs = LS.get(LS.favs).map(byId).filter(Boolean);
    var recents = LS.get(LS.recents).map(byId).filter(Boolean);
    var favWrap = $('#favWrap'), recWrap = $('#recentsWrap');
    if (favs.length) { favWrap.classList.remove('hidden'); $('#favChips').innerHTML = favs.map(function (c) { return chip(c, true); }).join(''); }
    else favWrap.classList.add('hidden');
    if (recents.length) { recWrap.classList.remove('hidden'); $('#recentsChips').innerHTML = recents.map(function (c) { return chip(c, false); }).join(''); }
    else recWrap.classList.add('hidden');
  }

  /* ---------- favorites / recents ---------- */
  function toggleFav(id) {
    var favs = LS.get(LS.favs);
    if (favs.indexOf(id) > -1) { favs = favs.filter(function (x) { return x !== id; }); toast('Removed from favorites'); }
    else { favs.push(id); toast('Added to favorites'); }
    LS.set(LS.favs, favs);
    renderGrid();
    if (currentCourt) syncFavBtn();
  }
  function pushRecent(id) {
    var r = LS.get(LS.recents).filter(function (x) { return x !== id; });
    r.unshift(id); r = r.slice(0, 5);
    LS.set(LS.recents, r);
  }

  /* ---------- shared cell builders ---------- */
  function joinBtn(p) {
    if (p.url) return '<a class="join join-' + p.kind + '" href="' + escAttr(p.url) + '" target="_blank" rel="noopener">' + videoIc + 'Join</a>';
    return '';
  }
  function codeRow(c) {
    return '<div class="id-row"><span class="lbl">' + esc(c.lbl) + '</span><span class="code">' + esc(c.val) + '</span>' +
      '<button class="copy" data-copy="' + escAttr(c.val) + '" aria-label="Copy ' + esc(c.lbl) + '">' + copyIc + '</button></div>';
  }
  function platCell(p) {
    var btn = joinBtn(p);
    var codes = p.codes.map(codeRow).join('');
    if (!btn && !codes) return '<span class="dash">—</span>';
    return '<div class="idcell">' + btn + codes + '</div>';
  }
  function nameHTML(n) {
    var parts = String(n).split('—');
    if (parts.length > 1) return esc(parts[0].trim()) + '<small>' + esc(parts.slice(1).join('—').trim()) + '</small>';
    return esc(n);
  }
  function kindDot(k) { return k === 'meet' ? 'm' : k === 'zoom' ? 'z' : k === 'bvc' ? 'b' : 'w'; }

  /* ---------- detail: desktop table ---------- */
  function buildTable(c, rows) {
    var plats = c.platforms || [];
    var hasExtra = (c.extras || []).length > 0;
    var head = '<th>#</th><th>Court / Judge</th>' +
      plats.map(function (p) { return '<th>' + esc(p.label) + '</th>'; }).join('') +
      (hasExtra ? '<th>Details</th>' : '');
    var body = rows.map(function (r, i) {
      var cells = plats.map(function (pdef) {
        var p = r.platforms.filter(function (x) { return x.label === pdef.label; })[0];
        return '<td>' + (p ? platCell(p) : '<span class="dash">—</span>') + '</td>';
      }).join('');
      var extraCell = '';
      if (hasExtra) {
        extraCell = '<td>' + (r.extras.length
          ? r.extras.map(function (e) { return '<div class="xrow"><span class="xl">' + esc(e.label) + '</span>' + esc(e.val) + '</div>'; }).join('')
          : '<span class="dash">—</span>') + '</td>';
      }
      return '<tr data-name="' + escAttr(r.search) + '"><td class="sr">' + (i + 1) + '</td>' +
        '<td class="cname">' + nameHTML(r.name) + '</td>' + cells + extraCell + '</tr>';
    }).join('');
    return '<table class="vc-table"><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table>';
  }

  /* ---------- detail / search: mobile cards ---------- */
  function cardHTML(r, i, badge) {
    var plats = r.platforms.map(function (p) {
      var btn = joinBtn(p) || '<span class="join dis">' + videoIc + '—</span>';
      var codes = p.codes.map(function (cp) {
        return '<div class="codepill"><span class="lbl">' + esc(cp.lbl) + '</span><span class="code">' + esc(cp.val) + '</span>' +
          '<button class="copy" data-copy="' + escAttr(cp.val) + '">' + copyIc + '</button></div>';
      }).join('');
      return '<div class="plat"><div class="plat-top"><div class="plat-name">' +
        '<span class="dotc ' + kindDot(p.kind) + '">' + videoIc + '</span>' + esc(p.label) + '</div>' + btn + '</div>' +
        (codes ? '<div class="plat-codes">' + codes + '</div>' : '') + '</div>';
    }).join('');
    var extras = r.extras.length
      ? '<div class="plat"><div class="plat-codes">' + r.extras.map(function (e) {
          return '<div class="codepill"><span class="lbl">' + esc(e.label) + '</span><span class="code">' + esc(e.val) + '</span></div>';
        }).join('') + '</div></div>'
      : '';
    var badgeHTML = badge ? '<span class="court-badge">' + esc(badge) + '</span>' : '';
    return '<div class="vc-card" data-name="' + escAttr(r.search) + '">' +
      '<div class="vc-card-head"><span class="num">' + (i + 1) + '</span><b>' + nameHTML(r.name) + '</b>' + badgeHTML + '</div>' +
      plats + extras + '</div>';
  }

  /* ---------- open a court (async, live fetch) ---------- */
  async function openCourt(id, push, force) {
    var c = byId(id);
    if (!c) return;
    currentCourt = c;
    pushRecent(id);
    $('#detailIcon').innerHTML = '<svg class="ic" viewBox="0 0 24 24">' + (ICONS[c.icon] || ICONS.building) + '</svg>';
    $('#detailName').textContent = c.name;
    $('#detailMeta').textContent = c.region;
    $('#tableCard').innerHTML = '';
    $('#cardsBody').innerHTML = '';
    $('#detailNoResults').style.display = 'none';
    $('#detailLoading').style.display = 'block';
    $('#detailLoading').innerHTML = '<div class="big">⏳</div>Loading court links…';
    syncFavBtn();
    showDetail();
    if (push !== false) location.hash = 'court/' + id;
    window.scrollTo({ top: $('.tool').offsetTop - 70, behavior: 'smooth' });
    try {
      var rows = await window.CVC.court(c, force);
      if (currentCourt !== c) return; // navigated away while loading
      $('#detailLoading').style.display = 'none';
      if (!rows.length) {
        $('#detailNoResults').style.display = 'block';
        $('#detailNoResults').innerHTML = '<div class="big">🗓️</div>No virtual-court links published for this court yet.';
        return;
      }
      $('#detailMeta').textContent = c.region + ' · ' + rows.length + ' virtual court' + (rows.length === 1 ? '' : 's');
      $('#tableCard').innerHTML = buildTable(c, rows);
      $('#cardsBody').innerHTML = rows.map(function (r, i) { return cardHTML(r, i); }).join('');
      var q = $('#searchInput').value.trim();
      if (q) runSearch(q); // re-apply in-detail filter if user was typing
    } catch (e) {
      if (currentCourt !== c) return;
      $('#detailLoading').style.display = 'block';
      $('#detailLoading').innerHTML = '<div class="big">⚠️</div>Couldn’t load data. Check your connection and tap Refresh.';
    }
  }

  function syncFavBtn() {
    if (!currentCourt) return;
    var isFav = LS.get(LS.favs).indexOf(currentCourt.id) > -1;
    var b = $('#favDetail');
    b.classList.toggle('on', isFav);
    b.querySelector('.t').textContent = isFav ? 'Favorited' : 'Favorite';
    b.querySelector('.ic').classList.toggle('ic-fill', isFav);
  }

  /* ---------- search ---------- */
  var searchSeq = 0;
  async function runSearch(raw) {
    var q = (raw || '').trim().toLowerCase();

    // In-detail: filter the rows/cards already on screen.
    if (currentCourt) {
      var visible = 0;
      $$('#tableCard tbody tr').forEach(function (tr) {
        var on = !q || tr.dataset.name.indexOf(q) > -1;
        tr.style.display = on ? '' : 'none'; if (on) visible++;
      });
      $$('#cardsBody .vc-card').forEach(function (card) {
        card.style.display = !q || card.dataset.name.indexOf(q) > -1 ? '' : 'none';
      });
      var dnr = $('#detailNoResults');
      dnr.style.display = visible ? 'none' : 'block';
      if (!visible) dnr.innerHTML = '<div class="big">🔍</div>No courts or judges match your search here.';
      return;
    }

    if (!q) { showHome(); return; }

    showSearch();
    $('#searchResults').innerHTML = '';
    $('#noResults').style.display = 'none';
    $('#searchLabel').innerHTML = '<svg class="ic" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>Searching…';
    var seq = ++searchSeq;
    try {
      var groups = await Promise.all(COURTS.map(async function (c) {
        try {
          var rows = await window.CVC.court(c);
          return rows.map(function (r, i) { return { c: c, r: r, i: i }; });
        } catch (e) { return []; }
      }));
      if (seq !== searchSeq) return; // a newer search superseded this one
      var matches = [];
      groups.forEach(function (g) {
        g.forEach(function (m) {
          if (m.r.search.indexOf(q) > -1 ||
              m.c.name.toLowerCase().indexOf(q) > -1 ||
              m.c.short.toLowerCase().indexOf(q) > -1) matches.push(m);
        });
      });
      $('#searchLabel').innerHTML = '<svg class="ic" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>' +
        matches.length + ' result' + (matches.length === 1 ? '' : 's') + ' for “' + esc(q) + '”';
      $('#searchResults').innerHTML = matches.slice(0, 80).map(function (m) {
        return cardHTML(m.r, m.i, m.c.short);
      }).join('');
      $('#noResults').style.display = matches.length ? 'none' : 'block';
    } catch (e) {
      if (seq !== searchSeq) return;
      $('#searchLabel').textContent = 'Search failed — please try again.';
    }
  }

  /* ---------- copy / share / toast ---------- */
  var toastT;
  function toast(msg) {
    $('#toastMsg').textContent = msg;
    var t = $('#toast'); t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('show'); }, 1800);
  }
  async function copy(text, el) {
    try { await navigator.clipboard.writeText(text); }
    catch (e) {
      var ta = document.createElement('textarea'); ta.value = text;
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e2) {}
      ta.remove();
    }
    if (el) { el.classList.add('done'); setTimeout(function () { el.classList.remove('done'); }, 1200); }
    toast('Copied: ' + text);
  }
  async function share() {
    if (!currentCourt) return;
    var url = location.origin + location.pathname + '#court/' + currentCourt.id;
    var data = { title: 'Court VC Links — ' + currentCourt.name, text: 'Virtual hearing links for ' + currentCourt.name, url: url };
    if (navigator.share) { try { await navigator.share(data); return; } catch (e) {} }
    copy(url);
  }

  /* ---------- events ---------- */
  document.addEventListener('click', function (e) {
    var fav = e.target.closest('[data-fav]');
    if (fav) { e.preventDefault(); e.stopPropagation(); toggleFav(fav.getAttribute('data-fav')); return; }
    var card = e.target.closest('[data-court]');
    if (card) { openCourt(card.getAttribute('data-court')); return; }
    var cp = e.target.closest('[data-copy]');
    if (cp) { copy(cp.getAttribute('data-copy'), cp); return; }
  });
  $('#backBtn').addEventListener('click', function () {
    location.hash = ''; showHome(); $('#searchInput').value = '';
    $('#searchBox').classList.remove('has-val');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  $('#favDetail').addEventListener('click', function () { if (currentCourt) toggleFav(currentCourt.id); });
  $('#shareBtn').addEventListener('click', share);
  var refreshBtn = $('#refreshBtn');
  if (refreshBtn) refreshBtn.addEventListener('click', function () { if (currentCourt) openCourt(currentCourt.id, false, true); });

  var si = $('#searchInput'), sb = $('#searchBox');
  var searchDebounce;
  si.addEventListener('input', function () {
    sb.classList.toggle('has-val', !!si.value);
    clearTimeout(searchDebounce);
    var val = si.value;
    // In-detail filtering is cheap → run immediately; global search debounces.
    if (currentCourt) { runSearch(val); return; }
    searchDebounce = setTimeout(function () { runSearch(val); }, 250);
  });
  $('#clearBtn').addEventListener('click', function () {
    si.value = ''; sb.classList.remove('has-val'); si.focus();
    if (currentCourt) runSearch(''); else showHome();
  });

  /* ---------- hash routing ---------- */
  function route() {
    var m = location.hash.match(/court\/([\w-]+)/);
    if (m && byId(m[1])) openCourt(m[1], false);
    else showHome();
  }
  window.addEventListener('hashchange', route);

  /* ---------- fee calculator (unchanged behaviour) ---------- */
  (function feeCalc() {
    /* Locked for now — calculator disabled. Remove this guard to re-enable. */
    var feeBtn = $('#feeBtn');
    if (feeBtn && feeBtn.classList.contains('locked')) return;

    var modal = $('#feeModal'), suit = $('#suitVal'), cap = $('#feeCap'),
        customWrap = $('#customRateWrap'), customRate = $('#customRate'),
        out = $('#feeOut'), wordsOut = $('#feeWords'), valWords = $('#valWords');
    if (!modal) return;
    var rate = 1;

    var ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
      'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
    var tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    function two(n) { return n < 20 ? ones[n] : (tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '')); }
    function three(n) { return (n > 99 ? ones[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' ' : '') : '') + (n % 100 ? two(n % 100) : ''); }
    function toWords(num) {
      num = Math.round(num);
      if (num === 0) return 'zero';
      var r = '';
      var crore = Math.floor(num / 1e7); num %= 1e7;
      var lakh = Math.floor(num / 1e5); num %= 1e5;
      var thou = Math.floor(num / 1e3); num %= 1e3;
      if (crore) r += three(crore) + ' crore ';
      if (lakh) r += three(lakh) + ' lakh ';
      if (thou) r += three(thou) + ' thousand ';
      if (num) r += three(num);
      return r.trim();
    }
    var fmt = function (n) { return '₹' + Math.round(n).toLocaleString('en-IN'); };
    var num = function (el) { return parseFloat((el.value || '').replace(/[^\d.]/g, '')) || 0; };

    function groupIndian(v) {
      var s = ('' + v).replace(/\D/g, '');
      if (!s) return '';
      var last3 = s.slice(-3), rest = s.slice(0, -3);
      return (rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' : '') + last3;
    }
    function calc() {
      var v = num(suit);
      var fee = v * (rate / 100);
      var c = num(cap);
      if (c > 0 && fee > c) fee = c;
      out.textContent = fmt(fee);
      wordsOut.textContent = 'Rupees ' + toWords(fee) + ' only';
      valWords.textContent = v ? 'Rupees ' + toWords(v) + ' only' : '';
    }
    [suit, cap].forEach(function (el) {
      el.addEventListener('input', function () { el.value = groupIndian(el.value); calc(); });
    });
    $('#rateSeg').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      $$('#rateSeg button').forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on');
      if (b.getAttribute('data-rate') === 'custom') { customWrap.style.display = 'flex'; customRate.focus(); rate = num(customRate); }
      else { customWrap.style.display = 'none'; rate = parseFloat(b.getAttribute('data-rate')); }
      calc();
    });
    customRate.addEventListener('input', function () { rate = num(customRate); calc(); });
    $('#feeCopy').addEventListener('click', function () { copy(out.textContent.replace('₹', '').trim(), $('#feeCopy')); });

    function open() { modal.classList.add('show'); document.body.style.overflow = 'hidden'; setTimeout(function () { suit.focus(); }, 150); }
    function close() { modal.classList.remove('show'); document.body.style.overflow = ''; }
    $('#feeBtn').addEventListener('click', open);
    $('#feeClose').addEventListener('click', close);
    modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modal.classList.contains('show')) close(); });
  })();

  /* ---------- init ---------- */
  renderGrid();
  route();
})();
