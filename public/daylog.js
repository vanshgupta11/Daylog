(function () {
  'use strict';
  var DAY = 86400000;
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DOWN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var urlParams = (typeof URLSearchParams !== 'undefined' && window.location) ? new URLSearchParams(window.location.search) : null;
  var currentUid = (urlParams && urlParams.get('uid')) || 'guest';
  var LS = 'daylog.v1.' + currentUid;
  var ALL = '__all';
  var HUES = 8;

  function $(s) { return document.querySelector(s); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function todayNum() { var d = new Date(); return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY); }
  var TODAY = todayNum();
  function dnDate(n) { return new Date(n * DAY); }
  function dow(n) { return (dnDate(n).getUTCDay() + 6) % 7; }
  function fmtDay(n) { var d = dnDate(n); return DOWN[d.getUTCDay()] + ', ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate() + ', ' + d.getUTCFullYear(); }
  function fmtShort(n) { var d = dnDate(n); return MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate(); }
  function fmt(x) { x = Math.round(x * 100) / 100; return x.toLocaleString('en-US'); }
  function uid() { return Math.random().toString(36).slice(2, 9); }

  /* ---------- state ---------- */
  var S = null, CH = {}, LV = {};
  var view = { kind: 'overview', id: null };
  var lastKey = '';
  var chartInstances = [];

  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function sampleState() {
    var R = rng(42), H = {}, L = {}, ord = 0;
    function add(id, name, parent, hue, goal, unit, extra) {
      H[id] = Object.assign({ id: id, name: name, parent: parent, hue: hue, goal: goal || 1, unit: unit || '', challenge: null, note: '', links: [], created: TODAY - 300, collapsed: false, order: ord++ }, extra || {});
    }
    add('body', 'Body', null, 0);
    add('workout', 'Workout', 'body', 0, 1, '', { challenge: { days: 30, start: TODAY - 17 }, note: 'Lift or run. Anything that raises the heart rate counts.' });
    add('walk', 'Walk', 'body', 5, 8000, 'steps');
    add('sleep', 'In bed by 11', 'body', 1);
    add('mind', 'Mind', null, 2);
    add('read', 'Read', 'mind', 2, 20, 'pages');
    add('meditate', 'Meditate', 'mind', 3, 10, 'min');
    add('craft', 'Craft', null, 4);
    add('code', 'Code', 'craft', 4);
    add('dsa', 'DSA problems', 'code', 4, 2, 'problems');
    add('build', 'Side project', 'code', 6, 45, 'min');
    add('write', 'Write', 'craft', 7);
    H.meditate.links = ['sleep']; H.read.links = ['write']; H.build.links = ['write'];
    var prob = { workout: .62, walk: .7, sleep: .55, read: .6, meditate: .5, dsa: .45, build: .4, write: .35 };
    Object.keys(prob).forEach(function (id) {
      var h = H[id], l = {};
      for (var d = TODAY - 260; d < TODAY; d++) {
        var tr = .55 + .45 * (d - (TODAY - 260)) / 260;
        var p = prob[id] * tr * 1.25;
        if ((id === 'build' || id === 'dsa') && dow(d) >= 5) p *= 1.3;
        if (id === 'workout' && d >= TODAY - 17) p = .92;
        if (R() < p) { l[d] = h.goal === 1 ? 1 : Math.max(1, Math.round(h.goal * (.35 + R() * .9))); }
      }
      L[id] = l;
    });
    L.read[TODAY] = 12; L.meditate[TODAY] = 10;
    return { v: 1, updated: 0, sample: true, habits: H, log: L };
  }

  function blankState() { return { v: 1, updated: Date.now(), sample: false, habits: {}, log: {} }; }

  function normalize(o) {
    o.habits = o.habits || {}; o.log = o.log || {};
    Object.keys(o.habits).forEach(function (id) {
      var h = o.habits[id];
      h.id = id; h.links = h.links || []; h.goal = h.goal > 0 ? h.goal : 1; h.unit = h.unit || '';
      h.note = h.note || ''; h.hue = (h.hue | 0) % HUES; h.created = h.created || TODAY;
      h.order = h.order || 0; h.parent = h.parent && o.habits[h.parent] ? h.parent : null;
    });
    return o;
  }

  function reindex() {
    CH = {}; LV = {};
    Object.keys(S.habits).forEach(function (id) { var p = S.habits[id].parent || ''; (CH[p] = CH[p] || []).push(id); });
    Object.keys(CH).forEach(function (p) { CH[p].sort(function (a, b) { return S.habits[a].order - S.habits[b].order; }); });
  }
  function children(pid) { return CH[pid || ''] || []; }
  function isGroup(id) { return id === ALL || (CH[id] && CH[id].length > 0) || false; }
  function leaves(id) {
    if (LV[id]) return LV[id];
    var r;
    if (id === ALL) r = Object.keys(S.habits).filter(function (x) { return !isGroup(x); });
    else if (!isGroup(id)) r = [id];
    else { r = []; children(id).forEach(function (c) { r = r.concat(leaves(c)); }); }
    LV[id] = r; return r;
  }
  function descendants(id) { var s = {}; s[id] = 1; (function w(p) { children(p).forEach(function (c) { s[c] = 1; w(c); }); })(id); return s; }
  function pathOf(id) { var a = [], h = S.habits[id]; while (h && h.parent) { h = S.habits[h.parent]; if (h) a.unshift(h); } return a; }
  function colorOf(id) { return 'var(--hab' + (S.habits[id] ? S.habits[id].hue : 0) + ')'; }
  function amount(id, d) { var l = S.log[id]; return l && l[d] ? l[d] : 0; }
  function lratio(id, d) { var h = S.habits[id]; if (d < h.created) return 0; return Math.min(1, amount(id, d) / h.goal); }
  function ratio(id, d) {
    if (!isGroup(id)) return lratio(id, d);
    var ls = leaves(id), n = 0, s = 0;
    for (var i = 0; i < ls.length; i++) { if (S.habits[ls[i]].created <= d) { n++; s += lratio(ls[i], d); } }
    return n ? s / n : 0;
  }
  function lvl(r) { return r <= 0 ? 0 : r < .34 ? 1 : r < .67 ? 2 : r < 1 ? 3 : 4; }
  function dayDone(id, d) { var r = ratio(id, d); return isGroup(id) ? r > 0 : r >= 1; }
  function stats(id) {
    var cur = 0, d = TODAY;
    if (!dayDone(id, d)) d--;
    while (d >= TODAY - 730 && dayDone(id, d)) { cur++; d--; }
    var best = 0, run = 0, total = 0, l30 = 0;
    for (var x = TODAY - 730; x <= TODAY; x++) {
      if (dayDone(id, x)) { run++; total++; if (run > best) best = run; if (x > TODAY - 30) l30++; } else run = 0;
    }
    return { cur: cur, best: best, total: total, l30: l30 };
  }
  function activeDays(id, n) { var c = 0; for (var x = TODAY - n + 1; x <= TODAY; x++) if (dayDone(id, x)) c++; return c; }
  function stepOf(g) { return g <= 10 ? 1 : g <= 60 ? 5 : g <= 200 ? 10 : g <= 2000 ? 100 : 500; }

  /* ---------- persistence ---------- */
  var apiConnected = false, saving = false, queued = false, saveT = 0, dirty = false, syncState = 'local';
  function snapshotJSON() { return JSON.stringify({ v: 1, updated: S.updated, sample: !!S.sample, habits: S.habits, log: S.log }); }
  function setSync(s) {
    syncState = s; var f = $('#sync'); if (f) {
      f.setAttribute('data-s', s);
      f.lastChild.textContent = ({ local: 'Saved in this browser', saving: 'Saving…', cloud: 'Synced to your account', error: 'Sync failed, kept in this browser' })[s];
    }
  }
  function persist() {
    try { localStorage.setItem(LS, snapshotJSON()); } catch (e) {}
    if (apiConnected) { dirty = true; setSync('saving'); clearTimeout(saveT); saveT = setTimeout(flush, 700); }
  }
  function flush() {
    if (!apiConnected) return;
    if (saving) { queued = true; return; }
    saving = true;
    var snap = snapshotJSON(), upd = S.updated;
    fetch('/api/data', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ json: snap, updated: upd })
    }).then(function (r) { return r.ok ? Promise.resolve() : Promise.reject(); })
      .then(function () {
        saving = false;
        if (queued) { queued = false; flush(); } else { dirty = false; setSync('cloud'); }
      })
      .catch(function () { saving = false; queued = false; setSync('error'); });
  }
  function loadLocal() { try { var raw = localStorage.getItem(LS); if (raw) { var o = JSON.parse(raw); if (o && o.habits) return normalize(o); } } catch (e) {} return null; }
  function adopt(o) {
    S = normalize(o); reindex();
    if (view.id && !S.habits[view.id]) view = { kind: 'overview', id: null };
    try { localStorage.setItem(LS, snapshotJSON()); } catch (e) {}
    render();
  }
  function connect() {
    // Connect to our REST backend using the JWT cookie set by the auth app
    fetch('/api/auth/me', { credentials: 'include' })
      .then(function (r) { return r.ok ? r.json() : Promise.reject('no session'); })
      .then(function () {
        // Authenticated — load cloud data
        return fetch('/api/data', { credentials: 'include' });
      })
      .then(function (r) { return r.ok ? r.json() : Promise.reject('load failed'); })
      .then(function (data) {
        apiConnected = true;
        if (data.exists) {
          var o = null;
          try { o = JSON.parse(data.json); } catch (e) {}
          if (o && o.habits) {
            if ((o.updated || 0) > (S.updated || 0)) { adopt(o); setSync('cloud'); return; }
            if ((o.updated || 0) < (S.updated || 0)) { flush(); return; }
            setSync('cloud');
          } else if (S.updated) { flush(); }
        } else if (S.updated) {
          flush();
        } else {
          setSync('cloud');
        }
      })
      .catch(function () {
        // Not authenticated or network error — stay on local mode
        apiConnected = false; setSync('local');
      });
  }

  function commit() { reindex(); S.updated = Date.now(); persist(); render(); }

  /* ---------- mutations ---------- */
  function setAmount(id, d, v) {
    v = Math.max(0, Math.round((Number(v) || 0) * 100) / 100);
    var l = S.log[id] = S.log[id] || {};
    if (v === 0) delete l[d]; else l[d] = v;
    commit();
  }
  function toggleToday(id) { var h = S.habits[id]; setAmount(id, TODAY, amount(id, TODAY) >= h.goal ? 0 : h.goal); }
  function nextOrder(pid) { var m = -1; children(pid).forEach(function (c) { if (S.habits[c].order > m) m = S.habits[c].order; }); return m + 1; }
  function connected(a, b) { return S.habits[a].links.indexOf(b) >= 0 || S.habits[b].links.indexOf(a) >= 0; }

  /* ---------- heatmap ---------- */
  function dayInfo(id, d) {
    var dd = dnDate(d);
    var head = DOWN[dd.getUTCDay()] + ', ' + MONTHS[dd.getUTCMonth()] + ' ' + dd.getUTCDate() + ', ' + dd.getUTCFullYear();
    if (!isGroup(id)) {
      var h = S.habits[id], a = amount(id, d);
      if (h.goal === 1 && !h.unit) return head + ' · ' + (a >= 1 ? 'Done' : 'Not done');
      return head + ' · ' + fmt(a) + ' / ' + fmt(h.goal) + (h.unit ? ' ' + h.unit : '');
    }
    var ls = leaves(id).filter(function (l) { return S.habits[l].created <= d; }), n = 0;
    ls.forEach(function (l) { if (amount(l, d) >= S.habits[l].goal) n++; });
    return head + ' · ' + n + ' of ' + ls.length + ' done';
  }
  function heat(id, o) {
    o = o || {};
    var weeks = o.weeks || 53, cell = o.cell || 11, gap = o.gap || 3, lab = !!o.labels;
    var color = o.color || colorOf(id);
    var left = lab ? 30 : 0, top = lab ? 18 : 0;
    var W = left + weeks * (cell + gap) - gap, H = top + 7 * (cell + gap) - gap;
    var start = TODAY - dow(TODAY) - (weeks - 1) * 7;
    var out = '<svg class="heat' + (lab ? ' big' : '') + '" role="img" aria-label="' + esc(o.aria || 'Activity heatmap') + '" viewBox="0 0 ' + W + ' ' + H + '" style="--h:' + color + '">';
    if (lab) {
      var marks = [], prev = -1;
      for (var c = 0; c < weeks; c++) { var m = dnDate(start + c * 7).getUTCMonth(); if (m !== prev) { marks.push({ c: c, m: m }); prev = m; } }
      if (marks.length > 1 && marks[1].c < 3) marks.shift();
      marks.forEach(function (k) { out += '<text x="' + (left + k.c * (cell + gap)) + '" y="10">' + MONTHS[k.m] + '</text>'; });
      [0, 2, 4].forEach(function (r) { out += '<text x="0" y="' + (top + r * (cell + gap) + cell - 1) + '">' + DOWN[r + 1] + '</text>'; });
    }
    for (var c2 = 0; c2 < weeks; c2++) {
      for (var r2 = 0; r2 < 7; r2++) {
        var d = start + c2 * 7 + r2; if (d > TODAY) break;
        out += '<rect class="c' + lvl(ratio(id, d)) + (d === TODAY ? ' td' : '') + '" x="' + (left + c2 * (cell + gap)) + '" y="' + (top + r2 * (cell + gap)) + '" width="' + cell + '" height="' + cell + '" rx="2" data-d="' + d + '" data-id="' + id + '"/>';
      }
    }
    return out + '</svg>';
  }
  function legend(color) { return '<div class="legend" style="--h:' + color + '">Less <i class="l0"></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i> More</div>'; }

  /* ---------- controls ---------- */
  var CHECK = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 4.8"/></svg>';
  function ctrl(id) {
    var h = S.habits[id], a = amount(id, TODAY), c = colorOf(id);
    if (h.goal === 1 && !h.unit) {
      return '<button class="chk' + (a >= 1 ? ' on' : '') + '" style="--h:' + c + '" data-act="tgl" data-id="' + id + '" aria-pressed="' + (a >= 1) + '" aria-label="Mark ' + esc(h.name) + ' done today">' + CHECK + '</button>';
    }
    return '<div class="stp' + (a >= h.goal ? ' met' : '') + '" style="--h:' + c + '"><button class="ib" data-act="stp" data-id="' + id + '" data-delta="-1" aria-label="Decrease">−</button>'
      + '<input type="number" min="0" step="any" inputmode="decimal" value="' + a + '" data-amt="' + id + '" aria-label="' + esc(h.name) + ' today">'
      + '<button class="ib" data-act="stp" data-id="' + id + '" data-delta="1" aria-label="Increase">+</button>'
      + '<span class="of">/ ' + fmt(h.goal) + '</span>' + (h.unit ? '<span class="u">' + esc(h.unit) + '</span>' : '') + '</div>';
  }
  function todayRow(id, path) {
    var h = S.habits[id];
    return '<div class="trw"><div class="trl"><span class="nm">' + esc(h.name) + '</span>' + (path ? '<span class="pth">' + esc(path) + '</span>' : '') + '</div>' + ctrl(id) + '</div>';
  }
  function relPath(id, upTo) { return pathOf(id).filter(function (p) { return !upTo || p.id !== upTo && !(pathOf(upTo).concat([S.habits[upTo]]).some(function (q) { return q.id === p.id; })); }).map(function (p) { return p.name; }).join(' / '); }

  /* ---------- sidebar & header ---------- */
  function ratioToday(id) { return ratio(id, TODAY); }
  function treeRows(pid, depth) {
    var o = '';
    children(pid).forEach(function (id) {
      var h = S.habits[id], g = isGroup(id), on = view.kind === 'habit' && view.id === id;
      var c = 'var(--hab' + h.hue + ')';
      o += '<div class="trow' + (on ? ' on' : '') + '" style="padding-left:' + (depth * 14) + 'px">'
        + '<button class="fold' + (g ? (h.collapsed ? '' : ' open') : ' sp') + '" data-act="fold" data-id="' + id + '" aria-label="' + (h.collapsed ? 'Expand' : 'Collapse') + ' ' + esc(h.name) + '" ' + (g ? '' : 'tabindex="-1" aria-hidden="true"') + '><svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 1.5L7 5L3.5 8.5"/></svg></button>'
        + '<button class="tmain" data-act="sel" data-id="' + id + '"><i class="dot" style="--c:' + c + '"></i><span class="tn">' + esc(h.name) + '</span></button>'
        + '<span class="ring" style="--c:' + c + ';--p:' + Math.round(ratioToday(id) * 100) + '"></span>'
        + '<button class="ib add" data-act="addc" data-id="' + id + '" aria-label="Add sub-skill to ' + esc(h.name) + '" title="Add sub-skill">+</button></div>';
      if (g && !h.collapsed) o += treeRows(id, depth + 1);
    });
    return o;
  }
  function renderSide() {
    $('#side').innerHTML = '<div class="brand"><svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><rect x="1" y="1" width="9" height="9" rx="2" fill="var(--fg)"/><rect x="12" y="1" width="9" height="9" rx="2" fill="var(--fg)" opacity=".45"/><rect x="1" y="12" width="9" height="9" rx="2" fill="var(--fg)" opacity=".2"/><rect x="12" y="12" width="9" height="9" rx="2" fill="var(--fg)" opacity=".75"/></svg>Daylog</div>'
      + '<button class="nav' + (view.kind === 'overview' ? ' on' : '') + '" data-act="nav" data-v="overview"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/></svg>Overview</button>'
      + '<button class="nav' + (view.kind === 'graph' ? ' on' : '') + '" data-act="nav" data-v="graph"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="4" cy="4" r="2"/><circle cx="12" cy="5" r="2"/><circle cx="7" cy="12" r="2"/><path d="M5.6 5l4.7.3M5 5.8l1.5 4.4M10.8 6.7L8.2 10.4"/></svg>Graph</button>'
      + '<button class="nav' + (view.kind === 'analytics' ? ' on' : '') + '" data-act="nav" data-v="analytics"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="9" width="3" height="5" rx="1"/><rect x="6.5" y="5" width="3" height="9" rx="1"/><rect x="11" y="2" width="3" height="12" rx="1"/></svg>Analytics</button>'
      + '<div class="sect"><span>Habits &amp; skills</span><button class="ib" data-act="new" aria-label="New habit" title="New habit">+</button></div>'
      + '<div class="tree">' + (Object.keys(S.habits).length ? treeRows(null, 0) : '<p class="muted" style="padding:4px 8px;font-size:13px">No habits yet.</p>') + '</div>'
      + '<div class="foot" id="sync" data-s="' + syncState + '"><i></i><span></span></div>';
    setSync(syncState);
  }
  function renderTop() {
    var t = '';
    if (view.kind === 'overview') t = '<span class="cur">Overview</span>';
    else if (view.kind === 'graph') t = '<span class="cur">Graph</span>';
    else if (view.kind === 'analytics') t = '<span class="cur">Analytics</span>';
    else {
      var p = pathOf(view.id);
      t = p.map(function (x) { return '<button data-act="sel" data-id="' + x.id + '">' + esc(x.name) + '</button><span class="sep">/</span>'; }).join('') + '<span class="cur">' + esc(S.habits[view.id].name) + '</span>';
    }
    var dd = dnDate(TODAY);
    $('#top').innerHTML = '<button class="btn ghost menu" data-act="menu" aria-label="Open habit list"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M2 4h12M2 8h12M2 12h12"/></svg></button>'
      + '<div class="crumb">' + t + '</div><span class="date">' + DOWN[dd.getUTCDay()] + ' ' + dd.getUTCDate() + ' ' + MONTHS[dd.getUTCMonth()] + ' ' + dd.getUTCFullYear() + '</span>'
      + '<button class="btn pri" data-act="new">New habit</button>';
  }

  /* ---------- views ---------- */
  function banner() {
    if (!S.sample) return '';
    return '<div class="banner"><span><b>Sample habits.</b> These are example entries so you can see how Daylog works.</span><span class="row2"><button class="btn sm" data-act="keep">Keep them</button><button class="btn sm pri" data-act="fresh">Start fresh</button></span></div>';
  }
  function statTiles(id) {
    var st = stats(id), g = isGroup(id);
    return '<div class="card tiles">'
      + '<div class="tile"><span class="lbl">' + (g ? 'Active streak' : 'Current streak') + '</span><b>' + st.cur + '<small> d</small></b></div>'
      + '<div class="tile"><span class="lbl">Longest</span><b>' + st.best + '<small> d</small></b></div>'
      + '<div class="tile"><span class="lbl">Days ' + (g ? 'active' : 'done') + '</span><b>' + st.total + '</b></div>'
      + '<div class="tile"><span class="lbl">Last 30 days</span><b>' + Math.round(st.l30 / 30 * 100) + '<small>%</small></b></div></div>';
  }
  function heatCard(id, title, color) {
    var n = activeDays(id, 365);
    return '<div class="card"><div class="ch"><h2>' + title + '</h2>' + legend(color) + '</div><div class="cb"><div class="hscroll" data-end>' + heat(id, { labels: true, color: color, aria: title }) + '</div><p class="muted" style="margin:10px 0 0;font-size:12px">' + n + ' active day' + (n === 1 ? '' : 's') + ' in the last year. Click a day to edit it.</p></div></div>';
  }
  function habitCard(id) {
    var h = S.habits[id], g = isGroup(id), st = stats(id), c = colorOf(id);
    var p = pathOf(id).map(function (x) { return x.name; }).join(' / ');
    var right;
    if (g) { var ls = leaves(id), n = 0; ls.forEach(function (l) { if (amount(l, TODAY) >= S.habits[l].goal) n++; }); right = '<span class="mono" style="font-size:12px;color:var(--fg2)">' + n + '/' + ls.length + ' today</span>'; }
    else right = ctrl(id);
    return '<article class="hc" data-act="sel" data-id="' + id + '" tabindex="0" role="button" aria-label="Open ' + esc(h.name) + '">'
      + '<div class="hd"><div class="nm"><i class="dot" style="--c:' + c + '"></i><span>' + esc(h.name) + '</span></div>' + right + '</div>'
      + (p ? '<div class="pth">' + esc(p) + '</div>' : '')
      + heat(id, { weeks: 26, cell: 9, gap: 2, aria: h.name + ' heatmap' })
      + '<div class="ft"><span>' + (g ? 'Active streak ' : 'Streak ') + st.cur + 'd</span><span>' + Math.round(st.l30 / 30 * 100) + '% · 30d</span></div></article>';
  }
  function viewOverview() {
    var ids = Object.keys(S.habits);
    if (!ids.length) return '<div class="stack">' + banner() + '<div class="card empty"><h2>Track your first habit</h2><p class="muted" style="margin:0;max-width:380px">Create a habit or a skill, nest smaller habits inside it, and watch each one fill its own heatmap.</p><button class="btn pri" data-act="new">New habit</button></div></div>';
    var lv = leaves(ALL).filter(function (l) { return S.habits[l].created <= TODAY; });
    var dn = lv.filter(function (l) { return amount(l, TODAY) >= S.habits[l].goal; }).length;
    var o = '<div class="stack">' + banner();
    o += '<div class="card"><div class="ch"><div><h2>Today</h2><span class="sub">' + dn + ' of ' + lv.length + ' habits done</span></div><div style="width:min(220px,100%);--h:var(--hab0)"><div class="pbar"><i style="width:' + (lv.length ? Math.round(dn / lv.length * 100) : 0) + '%"></i></div></div></div>';
    o += lv.map(function (l) { return todayRow(l, pathOf(l).map(function (x) { return x.name; }).join(' / ')); }).join('');
    o += '</div>';
    o += statTiles(ALL);
    o += heatCard(ALL, 'All habits combined', 'var(--hab0)');
    o += '<div><div class="row2" style="justify-content:space-between;margin-bottom:12px"><h2 style="font-size:16px">Every habit, its own heatmap</h2></div><div class="grid">';
    (function walk(pid) { children(pid).forEach(function (id) { o += habitCard(id); walk(id); }); })(null);
    o += '<button class="hc new" data-act="new">+ New habit</button></div></div></div>';
    return o;
  }
  function challengeCard(id) {
    var h = S.habits[id], c = h.challenge; if (!c) return '';
    var end = c.start + c.days - 1, dn = 0, ms = 0, col = colorOf(id);
    for (var d = c.start; d <= Math.min(end, TODAY); d++) { if (dayDone(id, d)) dn++; else if (d < TODAY) ms++; }
    var status;
    if (TODAY < c.start) status = 'Starts ' + fmtShort(c.start);
    else if (TODAY > end) status = dn === c.days ? 'Completed' : 'Ended';
    else status = 'Day ' + (TODAY - c.start + 1) + ' of ' + c.days;
    var cells = '';
    for (var x = c.start; x <= end; x++) {
      var k = x > TODAY ? 'fu' : dayDone(id, x) ? 'dn' : x === TODAY ? 'tn' : 'ms';
      cells += '<button class="cs ' + k + '" data-d="' + x + '" data-id="' + id + '" aria-label="' + esc(dayInfo(id, x)) + '"></button>';
    }
    var left = Math.max(0, end - TODAY);
    return '<div class="card" style="--h:' + col + '"><div class="ch"><div><h2>' + c.days + '-day challenge</h2><span class="sub">' + fmtShort(c.start) + ' to ' + fmtShort(end) + ' · ' + status + '</span></div><div class="row2"><button class="btn sm" data-act="chrestart" data-id="' + id + '">Restart today</button><button class="btn sm ghost" data-act="chend" data-id="' + id + '">End</button></div></div>'
      + '<div class="cb" style="display:flex;flex-direction:column;gap:14px"><div class="pbar"><i style="width:' + Math.round(dn / c.days * 100) + '%"></i></div><div class="cstrip">' + cells + '</div>'
      + '<div class="chstat"><span>' + dn + ' done</span><span>' + ms + ' missed</span><span>' + left + ' day' + (left === 1 ? '' : 's') + ' left</span></div></div></div>';
  }
  function viewHabit(id) {
    var h = S.habits[id];
    if (!h) { view = { kind: 'overview', id: null }; return viewOverview(); }
    var g = isGroup(id), c = colorOf(id), kids = children(id);
    var o = '<div class="stack">' + banner();
    o += '<div class="hhead"><div class="ttl"><i class="dot lg" style="--c:' + c + '"></i><h1>' + esc(h.name) + '</h1><span class="tag">' + (g ? leaves(id).length + ' habit' + (leaves(id).length === 1 ? '' : 's') : (h.goal > 1 || h.unit ? fmt(h.goal) + (h.unit ? ' ' + esc(h.unit) : '') + ' / day' : 'Daily')) + '</span></div>'
      + '<div class="acts"><button class="btn" data-act="addc" data-id="' + id + '">Add sub-skill</button><button class="btn" data-act="edit" data-id="' + id + '">Edit</button></div></div>';
    if (g) {
      var ls = leaves(id).filter(function (l) { return S.habits[l].created <= TODAY; }), dn = ls.filter(function (l) { return amount(l, TODAY) >= S.habits[l].goal; }).length;
      o += '<div class="card"><div class="ch"><div><h2>Today</h2><span class="sub">' + dn + ' of ' + ls.length + ' done</span></div><div style="width:min(220px,100%);--h:' + c + '"><div class="pbar"><i style="width:' + (ls.length ? Math.round(dn / ls.length * 100) : 0) + '%"></i></div></div></div>'
        + ls.map(function (l) { return todayRow(l, relPath(l, id)); }).join('') + '</div>';
    } else {
      o += '<div class="card"><div class="trw" style="border-top:0"><div class="trl"><span class="nm">Today</span><span class="pth">' + fmtDay(TODAY) + '</span></div>' + ctrl(id) + '</div></div>';
    }
    o += statTiles(id);
    o += challengeCard(id);
    o += heatCard(id, esc(h.name) + ' activity', c);
    if (g) {
      o += '<div><h2 style="font-size:16px;margin-bottom:12px">Sub-skills</h2><div class="grid">';
      kids.forEach(function (k) { o += habitCard(k); });
      o += '<button class="hc new" data-act="addc" data-id="' + id + '">+ Add sub-skill</button></div></div>';
    }
    var cons = Object.keys(S.habits).filter(function (x) { return x !== id && connected(id, x); });
    var opts = Object.keys(S.habits).filter(function (x) { return x !== id && !connected(id, x); }).map(function (x) { return '<option value="' + x + '">' + esc(S.habits[x].name) + '</option>'; }).join('');
    o += '<div class="card"><div class="ch"><div><h2>Connections</h2><span class="sub">Linked habits appear joined in the graph.</span></div></div><div class="cb" style="display:flex;flex-direction:column;gap:12px">'
      + '<div class="chips">' + (cons.length ? cons.map(function (x) { return '<span class="chip"><button class="o" data-act="sel" data-id="' + x + '" style="padding-right:4px"><i class="dot" style="--c:var(--hab' + S.habits[x].hue + ');display:inline-block;margin-right:6px"></i>' + esc(S.habits[x].name) + '</button><button data-act="unlink" data-id="' + id + '" data-to="' + x + '" aria-label="Remove link to ' + esc(S.habits[x].name) + '">×</button></span>'; }).join('') : '<span class="muted">Nothing linked yet.</span>') + '</div>'
      + (opts ? '<div class="row2"><select id="linksel" aria-label="Link to another habit"><option value="">Link to…</option>' + opts + '</select><button class="btn sm" data-act="link" data-id="' + id + '">Add link</button></div>' : '')
      + '</div></div>';
    o += '<div class="card"><div class="ch"><h2>Notes</h2></div><div class="cb"><textarea id="note" data-note="' + id + '" placeholder="Why this matters, the plan, what counts as done…" aria-label="Notes">' + esc(h.note || '') + '</textarea></div></div>';
    return o + '</div>';
  }
  function viewGraph() {
    if (!Object.keys(S.habits).length) return '<div class="stack" style="padding:24px 0"><div class="card empty"><h2>Nothing to graph yet</h2><p class="muted" style="margin:0">Add a few habits and they show up here as linked notes.</p><button class="btn pri" data-act="new">New habit</button></div></div>';
    return '<div class="gwrap" id="gwrap"><canvas id="gcv" aria-label="Graph of habits and skills. Select a node to see its details."></canvas>'
      + '<div class="gpanel"><label><input type="checkbox" data-g="labels"' + (G.labels ? ' checked' : '') + '> Labels</label><label><input type="checkbox" data-g="links"' + (G.links ? ' checked' : '') + '> Cross-links</label><button class="btn sm" data-act="gfit">Fit view</button></div>'
      + '<div class="gzoom"><button data-act="gzin" aria-label="Zoom in">+</button><button data-act="gzout" aria-label="Zoom out">−</button></div>'
      + '<div class="ginfo" id="ginfo" hidden></div></div>';
  }

  /* ---------- analytics ---------- */
  function destroyCharts() {
    chartInstances.forEach(function (ch) { try { ch.destroy(); } catch (e) {} });
    chartInstances = [];
  }

  function analyticsColors() {
    var cs = getComputedStyle(document.documentElement);
    return [0,1,2,3,4,5,6,7].map(function (i) { return cs.getPropertyValue('--hab' + i).trim(); });
  }

  function makeChart(id, type, data, options) {
    var el = document.getElementById(id);
    if (!el) return;
    var ch = new Chart(el, { type: type, data: data, options: options });
    chartInstances.push(ch);
    return ch;
  }

  function chartDefaults() {
    var cs = getComputedStyle(document.documentElement);
    var fg2 = cs.getPropertyValue('--fg2').trim();
    var line = cs.getPropertyValue('--line').trim();
    var fg = cs.getPropertyValue('--fg').trim();
    return { fg: fg, fg2: fg2, line: line };
  }

  function viewAnalytics() {
    var ids = leaves(ALL);
    if (!ids.length) {
      return '<div class="stack"><div class="card empty"><h2>No habits to analyse</h2><p class="muted" style="margin:0">Add some habits first, then come back here.</p><button class="btn pri" data-act="new">New habit</button></div></div>';
    }

    var html = '<div class="stack" id="analytics-stack">';
    // Row 1: Bar (weekly) + Line (30-day trend)
    html += '<div class="an-row">';
    html += '<div class="card an-card"><div class="ch"><div><h2>Weekly Completions</h2><span class="sub">Done-days per habit over the last 8 weeks</span></div></div><div class="cb an-cb"><canvas id="an-bar"></canvas></div></div>';
    html += '<div class="card an-card"><div class="ch"><div><h2>30-Day Completion Trend</h2><span class="sub">Daily overall completion rate (%)</span></div></div><div class="cb an-cb"><canvas id="an-line"></canvas></div></div>';
    html += '</div>';
    // Row 2: Doughnut + Radar + Polar
    html += '<div class="an-row">';
    html += '<div class="card an-card"><div class="ch"><div><h2>Today\'s Completion</h2><span class="sub">Done vs not-done habits</span></div></div><div class="cb an-cb an-sq"><canvas id="an-donut"></canvas></div></div>';
    html += '<div class="card an-card"><div class="ch"><div><h2>Habit Performance</h2><span class="sub">Last-30d completion rate per habit</span></div></div><div class="cb an-cb an-sq"><canvas id="an-radar"></canvas></div></div>';
    html += '<div class="card an-card"><div class="ch"><div><h2>All-Time Totals</h2><span class="sub">Total done-days per habit</span></div></div><div class="cb an-cb an-sq"><canvas id="an-polar"></canvas></div></div>';
    html += '</div>';
    html += '</div>';
    return html;
  }

  function initAnalyticsCharts() {
    if (typeof Chart === 'undefined') return;
    destroyCharts();
    var ids = leaves(ALL).filter(function (id) { return S.habits[id].created <= TODAY; });
    if (!ids.length) return;
    var colors = analyticsColors();
    var d = chartDefaults();
    var habColors = ids.map(function (id) { return colors[S.habits[id].hue % colors.length]; });

    // ── Bar: weekly completions (last 8 weeks) ──
    var weekLabels = [];
    var weekDatasets = ids.map(function (id) { return { label: S.habits[id].name, data: [], backgroundColor: habColors[ids.indexOf(id)] + 'bb', borderColor: habColors[ids.indexOf(id)], borderWidth: 1, borderRadius: 4 }; });
    for (var w = 7; w >= 0; w--) {
      var wStart = TODAY - w * 7 - 6, wEnd = TODAY - w * 7;
      var wDate = dnDate(wEnd);
      weekLabels.push(MONTHS[wDate.getUTCMonth()] + ' ' + wDate.getUTCDate());
      ids.forEach(function (id, i) {
        var cnt = 0;
        for (var dx = wStart; dx <= wEnd; dx++) { if (dayDone(id, dx)) cnt++; }
        weekDatasets[i].data.push(cnt);
      });
    }
    makeChart('an-bar', 'bar', { labels: weekLabels, datasets: weekDatasets }, {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: d.fg2, font: { size: 11 }, boxWidth: 12 } } },
      scales: {
        x: { ticks: { color: d.fg2, font: { size: 11 } }, grid: { color: d.line } },
        y: { ticks: { color: d.fg2, stepSize: 1, font: { size: 11 } }, grid: { color: d.line }, min: 0, max: 7 }
      }
    });

    // ── Line: 30-day overall trend ──
    var lineLabels = [], lineData = [];
    for (var day = TODAY - 29; day <= TODAY; day++) {
      var dd2 = dnDate(day);
      lineLabels.push(MONTHS[dd2.getUTCMonth()] + ' ' + dd2.getUTCDate());
      var done = ids.filter(function (id) { return dayDone(id, day); }).length;
      lineData.push(ids.length ? Math.round(done / ids.length * 100) : 0);
    }
    makeChart('an-line', 'line', {
      labels: lineLabels,
      datasets: [{ label: 'Completion %', data: lineData, borderColor: colors[1], backgroundColor: colors[1] + '22', fill: true, tension: 0.35, pointRadius: 2, pointHoverRadius: 5, borderWidth: 2 }]
    }, {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: d.fg2, font: { size: 11 } } } },
      scales: {
        x: { ticks: { color: d.fg2, maxTicksLimit: 10, font: { size: 11 } }, grid: { color: d.line } },
        y: { ticks: { color: d.fg2, callback: function (v) { return v + '%'; }, font: { size: 11 } }, grid: { color: d.line }, min: 0, max: 100 }
      }
    });

    // ── Doughnut: today done/not-done ──
    var todayDone = ids.filter(function (id) { return dayDone(id, TODAY); }).length;
    var todayMiss = ids.length - todayDone;
    makeChart('an-donut', 'doughnut', {
      labels: ['Done', 'Remaining'],
      datasets: [{ data: [todayDone, todayMiss], backgroundColor: [colors[0] + 'dd', d.line], borderWidth: 0, hoverOffset: 8 }]
    }, {
      responsive: true, maintainAspectRatio: false, cutout: '68%',
      plugins: {
        legend: { position: 'bottom', labels: { color: d.fg2, font: { size: 12 }, padding: 16 } },
        tooltip: { callbacks: { label: function (ctx) { return ctx.label + ': ' + ctx.raw + ' habit' + (ctx.raw !== 1 ? 's' : ''); } } }
      }
    });

    // ── Radar: last-30d per-habit rate ──
    var radarLabels = ids.map(function (id) { return S.habits[id].name; });
    var radarData = ids.map(function (id) { return Math.round(activeDays(id, 30) / 30 * 100); });
    makeChart('an-radar', 'radar', {
      labels: radarLabels,
      datasets: [{ label: 'Completion %', data: radarData, borderColor: colors[2], backgroundColor: colors[2] + '33', pointBackgroundColor: colors[2], borderWidth: 2, pointRadius: 4 }]
    }, {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: d.fg2, font: { size: 11 } } } },
      scales: { r: { beginAtZero: true, max: 100, ticks: { stepSize: 25, color: d.fg2, backdropColor: 'transparent', font: { size: 10 }, callback: function (v) { return v + '%'; } }, grid: { color: d.line }, pointLabels: { color: d.fg, font: { size: 11 } }, angleLines: { color: d.line } } }
    });

    // ── Polar Area: all-time totals ──
    var polarData = ids.map(function (id) { var l = S.log[id] || {}; return Object.keys(l).length; });
    makeChart('an-polar', 'polarArea', {
      labels: ids.map(function (id) { return S.habits[id].name; }),
      datasets: [{ data: polarData, backgroundColor: habColors.map(function (c) { return c + 'bb'; }), borderWidth: 0 }]
    }, {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { color: d.fg2, font: { size: 11 }, boxWidth: 12 } } },
      scales: { r: { ticks: { color: d.fg2, backdropColor: 'transparent', font: { size: 10 } }, grid: { color: d.line }, angleLines: { color: d.line } } }
    });
  }

  /* ---------- render ---------- */
  function render() {
    TODAY = todayNum();
    var key = view.kind + ':' + (view.id || '');
    var ct = $('#content'), st = key === lastKey ? ct.scrollTop : 0;
    if (view.kind !== 'graph') gStop();
    if (view.kind !== 'analytics') destroyCharts();
    renderSide(); renderTop();
    ct.className = 'content' + (view.kind === 'graph' ? ' gv' : '');
    if (view.kind === 'graph') ct.innerHTML = viewGraph();
    else if (view.kind === 'analytics') ct.innerHTML = viewAnalytics();
    else if (view.kind === 'habit') ct.innerHTML = viewHabit(view.id);
    else ct.innerHTML = viewOverview();
    ct.scrollTop = st; lastKey = key;
    var hs = ct.querySelectorAll('[data-end]'); for (var i = 0; i < hs.length; i++) hs[i].scrollLeft = hs[i].scrollWidth;
    if (view.kind === 'graph' && $('#gcv')) gInit();
    if (view.kind === 'analytics') setTimeout(initAnalyticsCharts, 0);
  }

  /* ---------- tooltip & day popover ---------- */
  var tip = $('#tip'), pop = $('#pop');
  function showTip(t, x, y) { tip.textContent = t; tip.hidden = false; var w = tip.offsetWidth; tip.style.left = Math.max(8, Math.min(innerWidth - w - 8, x - w / 2)) + 'px'; tip.style.top = Math.max(8, y - 34) + 'px'; }
  function hideTip() { tip.hidden = true; }
  function openPop(id, d, target) {
    hideTip();
    var h = S.habits[id], r = target.getBoundingClientRect(), html;
    if (isGroup(id)) {
      var ls = leaves(id).filter(function (l) { return S.habits[l].created <= d; });
      html = '<div class="pt">' + fmtDay(d) + '</div><div class="bl">' + (ls.length ? ls.map(function (l) { var x = S.habits[l]; return '<div><span>' + esc(x.name) + '</span><span class="mono muted">' + fmt(amount(l, d)) + ' / ' + fmt(x.goal) + '</span></div>'; }).join('') : '<span class="muted">No habits existed yet.</span>') + '</div><span class="muted" style="font-size:12px">Open a sub-skill to edit this day.</span>';
    } else {
      var a = amount(id, d);
      html = '<div class="pt">' + esc(h.name) + '<div class="muted" style="font-weight:400;font-size:12px">' + fmtDay(d) + '</div></div>'
        + '<div><input id="pop-amt" type="number" min="0" step="any" inputmode="decimal" value="' + a + '" aria-label="Amount' + (h.unit ? ' in ' + esc(h.unit) : '') + '"></div>'
        + '<div class="row2"><button class="btn sm pri" data-act="pset" data-id="' + id + '" data-d="' + d + '">Save</button><button class="btn sm" data-act="pdone" data-id="' + id + '" data-d="' + d + '">Goal met</button><button class="btn sm ghost" data-act="pclear" data-id="' + id + '" data-d="' + d + '">Clear</button></div>';
    }
    pop.innerHTML = html; pop.hidden = false;
    var w = pop.offsetWidth, ph = pop.offsetHeight;
    var x = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2));
    var y = r.bottom + 8; if (y + ph > innerHeight - 8) y = Math.max(8, r.top - ph - 8);
    pop.style.left = x + 'px'; pop.style.top = y + 'px';
    var inp = $('#pop-amt'); if (inp) { inp.focus(); inp.select(); }
  }
  function closePop() { pop.hidden = true; }
  var toastT = 0;
  function toast(m) { var t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, 2600); }

  /* ---------- form ---------- */
  var form = null;
  function parentOptions(excl, sel) {
    var o = '<option value="">None (top level)</option>';
    (function walk(pid, dep) {
      children(pid).forEach(function (c) {
        if (excl && excl[c]) return;
        o += '<option value="' + c + '"' + (sel === c ? ' selected' : '') + '>' + '  '.repeat(dep) + esc(S.habits[c].name) + '</option>';
        walk(c, dep + 1);
      });
    })(null, 0);
    return o;
  }
  function openForm(id, parent) {
    var h = id ? S.habits[id] : null;
    var x = h || { name: '', parent: parent || null, hue: Object.keys(S.habits).length % HUES, goal: 1, unit: '', challenge: null };
    form = { id: id, hue: x.hue, confirm: false };
    var grp = h && isGroup(id);
    var sw = ''; for (var i = 0; i < HUES; i++) sw += '<button type="button" data-hue="' + i + '" class="' + (i === x.hue ? 'on' : '') + '" style="--c:var(--hab' + i + ')" aria-label="Colour ' + (i + 1) + '"></button>';
    var days = x.challenge ? x.challenge.days : 30;
    $('#modal').innerHTML = '<div class="modal" role="dialog" aria-modal="true" aria-label="' + (h ? 'Edit habit' : 'New habit') + '"><form id="hform" novalidate><div class="mh">' + (h ? 'Edit habit' : 'New habit') + '</div><div class="mb">'
      + '<div class="fld"><label for="f-name">Name</label><input type="text" id="f-name" value="' + esc(x.name) + '" maxlength="60" placeholder="e.g. Read, Python, Cold shower" autocomplete="off"><span class="err" id="f-err" hidden>Give it a name.</span></div>'
      + '<div class="fld"><label for="f-parent">Inside</label><select id="f-parent">' + parentOptions(h ? descendants(id) : null, x.parent) + '</select><span class="hint" id="f-hint" hidden>This habit has check-ins of its own. Once it holds sub-skills, only the sub-skills count toward its heatmap.</span></div>'
      + '<div class="fld"><span class="lb">Colour</span><div class="sw" id="f-sw">' + sw + '</div></div>'
      + (grp ? '<p class="muted" style="margin:0;font-size:12px">This is a group. Its heatmap combines its sub-skills, so it has no target of its own.</p>' : '<div class="two"><div class="fld"><label for="f-goal">Daily target</label><input type="number" id="f-goal" min="0.01" step="any" value="' + x.goal + '"></div><div class="fld"><label for="f-unit">Unit</label><input type="text" id="f-unit" value="' + esc(x.unit) + '" maxlength="16" placeholder="pages, min…"></div><span class="hint" style="grid-column:1/-1">Leave the target at 1 with no unit for a simple done or not done habit.</span></div>')
      + '<div class="fld"><label class="chk2"><input type="checkbox" id="f-ch"' + (x.challenge ? ' checked' : '') + '> Run as a challenge</label>'
      + '<div id="f-chbox" ' + (x.challenge ? '' : 'hidden') + ' style="display:flex;flex-direction:column;gap:8px"><div class="row2"><input type="number" id="f-days" min="1" max="365" value="' + days + '" style="width:84px" aria-label="Challenge length in days"><span class="muted">days</span>'
      + [7, 21, 30, 66, 100].map(function (n) { return '<button type="button" class="btn sm" data-days="' + n + '">' + n + '</button>'; }).join('') + '</div><span class="hint">' + (x.challenge ? 'Changing the length keeps the original start date.' : 'Starts today. Every day in the window needs to be done to complete it.') + '</span></div></div>'
      + '</div><div class="mf"><div>' + (h ? (form.confirm ? '' : '<button type="button" class="btn dng" data-act="fdel">Delete</button>') : '') + '</div><div class="r"><button type="button" class="btn" data-act="fcancel">Cancel</button><button type="submit" class="btn pri">' + (h ? 'Save' : 'Create') + '</button></div></div></form></div>';
    $('#modal').hidden = false;
    syncHint();
    var n = $('#f-name'); n.focus(); n.setSelectionRange(n.value.length, n.value.length);
  }
  function syncHint() {
    var sel = $('#f-parent'); if (!sel) return;
    var p = sel.value, hint = $('#f-hint');
    hint.hidden = !(p && !isGroup(p) && S.log[p] && Object.keys(S.log[p]).length && (!form.id || p !== form.id));
  }
  function closeForm() { $('#modal').hidden = true; form = null; }
  function saveForm() {
    var name = $('#f-name').value.trim();
    if (!name) { $('#f-err').hidden = false; $('#f-name').focus(); return; }
    var parent = $('#f-parent').value || null;
    var goalEl = $('#f-goal'), goal = goalEl ? Math.max(0.01, Number(goalEl.value) || 1) : null, unit = $('#f-unit') ? $('#f-unit').value.trim() : null;
    var hasCh = $('#f-ch').checked, days = Math.max(1, Math.min(365, parseInt($('#f-days').value, 10) || 30));
    var h;
    if (form.id) {
      h = S.habits[form.id];
      if ((h.parent || null) !== parent) { h.parent = parent; h.order = nextOrder(parent); }
    } else {
      var id = uid();
      h = S.habits[id] = { id: id, name: name, parent: parent, hue: 0, goal: 1, unit: '', challenge: null, note: '', links: [], created: TODAY, collapsed: false, order: nextOrder(parent) };
      view = { kind: 'habit', id: id };
    }
    h.name = name; h.hue = form.hue;
    if (goal !== null) { h.goal = goal; h.unit = unit; }
    if (hasCh) h.challenge = h.challenge ? { days: days, start: h.challenge.start } : { days: days, start: TODAY }; else h.challenge = null;
    if (parent && S.habits[parent]) S.habits[parent].collapsed = false;
    closeForm(); commit();
  }
  function deleteHabit(id) {
    var h = S.habits[id];
    children(id).forEach(function (c) { S.habits[c].parent = h.parent; });
    delete S.habits[id]; delete S.log[id];
    Object.keys(S.habits).forEach(function (k) { S.habits[k].links = S.habits[k].links.filter(function (x) { return x !== id; }); });
    delete G.pos[id];
    if (view.id === id) view = { kind: 'overview', id: null };
    if (G.sel === id) G.sel = null;
    closeForm(); commit(); toast('Deleted ' + h.name);
  }

  /* ---------- graph ---------- */
  var G = { nodes: [], byId: {}, edges: [], pos: {}, tx: 0, ty: 0, k: 1, alpha: 0, raf: 0, active: false, hover: null, sel: null, drag: null, pan: null, labels: true, links: true, w: 0, h: 0, dpr: 1, cv: null, ctx: null, ro: null, settled: false };
  function gSync() {
    var ids = Object.keys(S.habits);
    Object.keys(G.pos).forEach(function (k) { if (!S.habits[k]) delete G.pos[k]; });
    G.nodes = ids.map(function (id) {
      var h = S.habits[id], p = G.pos[id];
      if (!p) { var pp = h.parent && G.pos[h.parent], a = Math.random() * 6.283; p = G.pos[id] = { x: (pp ? pp.x : 0) + Math.cos(a) * 45, y: (pp ? pp.y : 0) + Math.sin(a) * 45, vx: 0, vy: 0 }; }
      var st = stats(id), g = isGroup(id);
      return { id: id, p: p, hue: h.hue, group: g, r: (g ? 8 : 5) + Math.min(8, Math.sqrt(st.total) * .45), done: !g && amount(id, TODAY) >= h.goal, streak: st.cur };
    });
    G.byId = {}; G.nodes.forEach(function (n) { G.byId[n.id] = n; });
    G.edges = []; var seen = {};
    ids.forEach(function (id) { var h = S.habits[id]; if (h.parent) G.edges.push({ a: h.parent, b: id, t: 'tree' }); });
    ids.forEach(function (id) { S.habits[id].links.forEach(function (o) { if (!S.habits[o]) return; var k = [id, o].sort().join('|'); if (seen[k]) return; seen[k] = 1; G.edges.push({ a: id, b: o, t: 'link' }); }); });
  }
  function gTick() {
    var N = G.nodes, a = G.alpha, i, j;
    for (i = 0; i < N.length; i++) {
      for (j = i + 1; j < N.length; j++) {
        var A = N[i].p, B = N[j].p, dx = B.x - A.x, dy = B.y - A.y, d2 = dx * dx + dy * dy;
        if (d2 < 1) { dx = Math.random() - .5; dy = Math.random() - .5; d2 = 1; }
        if (d2 > 90000) continue;
        var d = Math.sqrt(d2), f = 260 / d * a, fx = dx / d * f, fy = dy / d * f;
        A.vx -= fx; A.vy -= fy; B.vx += fx; B.vy += fy;
      }
    }
    G.edges.forEach(function (e) {
      if (e.t === 'link' && !G.links) return;
      var A = G.byId[e.a].p, B = G.byId[e.b].p, dx = B.x - A.x, dy = B.y - A.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      var rest = e.t === 'tree' ? 62 : 130, f = (d - rest) * (e.t === 'tree' ? .06 : .015) * a, fx = dx / d * f, fy = dy / d * f;
      A.vx += fx; A.vy += fy; B.vx -= fx; B.vy -= fy;
    });
    N.forEach(function (n) {
      var p = n.p;
      p.vx -= p.x * .012 * a; p.vy -= p.y * .012 * a;
      if (G.drag && G.drag.id === n.id) { p.vx = 0; p.vy = 0; return; }
      p.vx *= .72; p.vy *= .72; p.x += p.vx; p.y += p.vy;
    });
  }
  function gColor(i) { return getComputedStyle(G.cv).getPropertyValue('--hab' + i).trim() || '#888'; }
  function gNeigh(id) { var s = {}; s[id] = 1; G.edges.forEach(function (e) { if (e.t === 'link' && !G.links) return; if (e.a === id) s[e.b] = 1; if (e.b === id) s[e.a] = 1; }); return s; }
  function gScreen(n) { return { x: G.w / 2 + G.tx + n.p.x * G.k, y: G.h / 2 + G.ty + n.p.y * G.k, r: n.r * Math.max(.7, Math.min(G.k, 1.5)) }; }
  function gDraw() {
    if (!G.ctx) return;
    var ctx = G.ctx, cs = getComputedStyle(G.cv);
    var bg = cs.getPropertyValue('--bg').trim(), edge = cs.getPropertyValue('--edge').trim(), hi = cs.getPropertyValue('--fg2').trim(), fg = cs.getPropertyValue('--fg').trim(), fg2 = hi;
    var focus = G.hover || G.sel, nb = focus ? gNeigh(focus) : null;
    ctx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0); ctx.clearRect(0, 0, G.w, G.h);
    ctx.lineWidth = 1;
    G.edges.forEach(function (e) {
      if (e.t === 'link' && !G.links) return;
      var a = gScreen(G.byId[e.a]), b = gScreen(G.byId[e.b]), on = focus && (e.a === focus || e.b === focus);
      ctx.globalAlpha = focus ? (on ? 1 : .15) : 1; ctx.strokeStyle = on ? hi : edge; ctx.setLineDash(e.t === 'link' ? [4, 4] : []);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    });
    ctx.setLineDash([]);
    G.nodes.forEach(function (n) {
      var s = gScreen(n), c = gColor(n.hue);
      ctx.globalAlpha = (focus && !nb[n.id]) ? 0.25 : 1;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.2832);
      if (n.group) { ctx.fillStyle = bg; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = c; ctx.stroke(); }
      else { ctx.fillStyle = c; ctx.fill(); }
      if (n.done) { ctx.lineWidth = 1.5; ctx.strokeStyle = c; ctx.globalAlpha *= .45; ctx.beginPath(); ctx.arc(s.x, s.y, s.r + 4, 0, 6.2832); ctx.stroke(); }
      if (G.sel === n.id) { ctx.globalAlpha = 1; ctx.lineWidth = 1.5; ctx.strokeStyle = fg; ctx.beginPath(); ctx.arc(s.x, s.y, s.r + 7, 0, 6.2832); ctx.stroke(); }
    });
    ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.font = '500 12px ' + getComputedStyle(document.body).fontFamily;
    G.nodes.forEach(function (n) {
      var show = G.labels && G.k >= .55 || focus === n.id || (focus && nb[n.id]);
      if (!show) return;
      var s = gScreen(n);
      ctx.globalAlpha = (focus && !nb[n.id]) ? 0.2 : 1; ctx.fillStyle = focus === n.id ? fg : fg2;
      ctx.fillText(S.habits[n.id].name, s.x, s.y + s.r + (G.sel === n.id ? 10 : 6));
    });
    ctx.globalAlpha = 1;
  }
  function gLoop() {
    G.raf = 0; if (!G.active) return;
    if (G.alpha > .01 || G.drag) { gTick(); G.alpha *= .992; }
    gDraw();
    if (G.alpha > .01 || G.drag) G.raf = requestAnimationFrame(gLoop);
  }
  function gKick(a) { G.alpha = Math.max(G.alpha, a || .4); if (!G.raf && G.active) G.raf = requestAnimationFrame(gLoop); }
  function gRedraw() { if (!G.raf && G.active) G.raf = requestAnimationFrame(function () { G.raf = 0; gDraw(); }); }
  function gStop() { G.active = false; if (G.raf) { cancelAnimationFrame(G.raf); G.raf = 0; } if (G.ro) { G.ro.disconnect(); G.ro = null; } G.cv = null; G.ctx = null; }
  function gFit() {
    if (!G.nodes.length) return;
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    G.nodes.forEach(function (n) { x0 = Math.min(x0, n.p.x); x1 = Math.max(x1, n.p.x); y0 = Math.min(y0, n.p.y); y1 = Math.max(y1, n.p.y); });
    var bw = x1 - x0 + 140, bh = y1 - y0 + 140;
    G.k = Math.max(.3, Math.min(1.5, Math.min(G.w / bw, G.h / bh)));
    G.tx = -((x0 + x1) / 2) * G.k; G.ty = -((y0 + y1) / 2) * G.k;
    gRedraw();
  }
  function gResize() {
    var wrap = $('#gwrap'); if (!wrap || !G.cv) return;
    G.w = wrap.clientWidth; G.h = wrap.clientHeight; G.dpr = window.devicePixelRatio || 1;
    G.cv.width = Math.round(G.w * G.dpr); G.cv.height = Math.round(G.h * G.dpr);
    gDraw();
  }
  function gHit(px, py) {
    var best = null, bd = 1e9;
    G.nodes.forEach(function (n) { var s = gScreen(n), d = Math.hypot(px - s.x, py - s.y); if (d <= s.r + 5 && d < bd) { bd = d; best = n; } });
    return best;
  }
  function gInfo() {
    var el = $('#ginfo'); if (!el) return;
    var id = G.sel;
    if (!id || !S.habits[id]) { el.hidden = true; return; }
    var h = S.habits[id], st = stats(id), g = isGroup(id);
    var p = pathOf(id).map(function (x) { return x.name; }).join(' / ');
    var today = g ? (Math.round(ratio(id, TODAY) * 100) + '% today') : (amount(id, TODAY) >= h.goal ? 'Done today' : 'Not done today');
    el.innerHTML = '<div class="nm"><i class="dot" style="--c:var(--hab' + h.hue + ')"></i>' + esc(h.name) + '</div>' + (p ? '<div class="pth">' + esc(p) + '</div>' : '') + '<div class="st">' + today + ' · streak ' + st.cur + 'd</div><div class="row2"><button class="btn sm pri" data-act="sel" data-id="' + id + '">Open</button>' + (g ? '' : '<button class="btn sm" data-act="tgl" data-id="' + id + '">' + (amount(id, TODAY) >= h.goal ? 'Undo today' : 'Mark today') + '</button>') + '</div>';
    el.hidden = false;
  }
  function gInit() {
    gStop();
    G.cv = $('#gcv'); G.ctx = G.cv.getContext('2d'); G.active = true;
    gSync();
    gResize();
    if (!G.settled) { G.alpha = 1; for (var i = 0; i < 300; i++) { gTick(); G.alpha *= .985; } G.alpha = 0; G.settled = true; gFit(); }
    G.sel = G.sel && S.habits[G.sel] ? G.sel : null;
    gInfo();
    gKick(.3);
    if (window.ResizeObserver) { G.ro = new ResizeObserver(function () { gResize(); }); G.ro.observe($('#gwrap')); }
    var cv = G.cv;
    cv.addEventListener('pointerdown', function (e) {
      var r = cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top, n = gHit(px, py);
      cv.setPointerCapture(e.pointerId);
      if (n) { G.drag = { id: n.id, sx: px, sy: py, moved: false }; }
      else G.pan = { sx: px, sy: py, tx: G.tx, ty: G.ty, moved: false };
      cv.style.cursor = 'grabbing';
    });
    cv.addEventListener('pointermove', function (e) {
      var r = cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
      if (G.drag) {
        if (Math.hypot(px - G.drag.sx, py - G.drag.sy) > 4) G.drag.moved = true;
        if (G.drag.moved) { var n = G.byId[G.drag.id]; n.p.x = (px - G.w / 2 - G.tx) / G.k; n.p.y = (py - G.h / 2 - G.ty) / G.k; n.p.vx = 0; n.p.vy = 0; gKick(.35); }
      } else if (G.pan) {
        if (Math.hypot(px - G.pan.sx, py - G.pan.sy) > 4) G.pan.moved = true;
        G.tx = G.pan.tx + (px - G.pan.sx); G.ty = G.pan.ty + (py - G.pan.sy); gRedraw();
      } else {
        var h = gHit(px, py), id = h ? h.id : null;
        if (id !== G.hover) { G.hover = id; cv.style.cursor = id ? 'pointer' : 'grab'; gRedraw(); }
      }
    });
    function up(e) {
      if (G.drag) { var id = G.drag.id, moved = G.drag.moved; G.drag = null; if (!moved) { G.sel = G.sel === id ? null : id; gInfo(); gRedraw(); } else gKick(.3); }
      else if (G.pan) { var m = G.pan.moved; G.pan = null; if (!m && G.sel) { G.sel = null; gInfo(); gRedraw(); } }
      cv.style.cursor = G.hover ? 'pointer' : 'grab';
    }
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('pointerleave', function () { if (!G.drag && !G.pan && G.hover) { G.hover = null; gRedraw(); } });
    cv.addEventListener('dblclick', function (e) { var r = cv.getBoundingClientRect(), n = gHit(e.clientX - r.left, e.clientY - r.top); if (n) go({ kind: 'habit', id: n.id }); });
    cv.addEventListener('wheel', function (e) {
      e.preventDefault();
      var r = cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
      gZoom(Math.exp(-e.deltaY * .0015), px, py);
    }, { passive: false });
  }
  function gZoom(f, px, py) {
    if (px === undefined) { px = G.w / 2; py = G.h / 2; }
    var k = Math.max(.3, Math.min(3, G.k * f)), wx = (px - G.w / 2 - G.tx) / G.k, wy = (py - G.h / 2 - G.ty) / G.k;
    G.k = k; G.tx = px - G.w / 2 - wx * k; G.ty = py - G.h / 2 - wy * k; gRedraw();
  }

  /* ---------- navigation & events ---------- */
  function go(v) { view = v; closeSide(); closePop(); hideTip(); render(); }
  function openSide() { $('#side').classList.add('open'); $('#scrim').hidden = false; }
  function closeSide() { $('#side').classList.remove('open'); $('#scrim').hidden = true; }

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (t.closest && (t.closest('input,select,textarea') || (t.closest('.stp') && !t.closest('button')))) return;
    if (!pop.hidden && !pop.contains(t) && !(t.closest && t.closest('[data-d]'))) closePop();
    var cell = t.closest && t.closest('[data-d]');
    if (cell && !t.closest('[data-act]')) { openPop(cell.getAttribute('data-id'), Number(cell.getAttribute('data-d')), cell); return; }
    var el = t.closest && t.closest('[data-act]');
    if (!el) {
      var sw = t.closest && t.closest('[data-hue]'), dy = t.closest && t.closest('[data-days]');
      if (sw && form) { form.hue = Number(sw.getAttribute('data-hue')); var all = document.querySelectorAll('#f-sw button'); for (var i = 0; i < all.length; i++) all[i].classList.toggle('on', all[i] === sw); }
      if (dy) $('#f-days').value = dy.getAttribute('data-days');
      if (t.id === 'modal') closeForm();
      if (t.id === 'scrim') closeSide();
      return;
    }
    var a = el.getAttribute('data-act'), id = el.getAttribute('data-id');
    switch (a) {
      case 'nav': go({ kind: el.getAttribute('data-v'), id: null }); break;
      case 'sel': go({ kind: 'habit', id: id }); break;
      case 'fold': S.habits[id].collapsed = !S.habits[id].collapsed; persist(); renderSide(); break;
      case 'new': closeSide(); openForm(null, null); break;
      case 'addc': closeSide(); openForm(null, id); break;
      case 'edit': openForm(id); break;
      case 'menu': openSide(); break;
      case 'tgl': toggleToday(id); break;
      case 'stp': { var h = S.habits[id]; setAmount(id, TODAY, amount(id, TODAY) + Number(el.getAttribute('data-delta')) * stepOf(h.goal)); break; }
      case 'pset': { var v = $('#pop-amt').value; closePop(); setAmount(id, Number(el.getAttribute('data-d')), v); break; }
      case 'pdone': closePop(); setAmount(id, Number(el.getAttribute('data-d')), S.habits[id].goal); break;
      case 'pclear': closePop(); setAmount(id, Number(el.getAttribute('data-d')), 0); break;
      case 'chrestart': S.habits[id].challenge.start = TODAY; commit(); toast('Challenge restarted from today'); break;
      case 'chend': S.habits[id].challenge = null; commit(); break;
      case 'link': { var sel = $('#linksel'); if (sel && sel.value) { S.habits[id].links.push(sel.value); commit(); } break; }
      case 'unlink': { var to = el.getAttribute('data-to'); S.habits[id].links = S.habits[id].links.filter(function (x) { return x !== to; }); S.habits[to].links = S.habits[to].links.filter(function (x) { return x !== id; }); commit(); break; }
      case 'keep': S.sample = false; commit(); break;
      case 'fresh': S = blankState(); view = { kind: 'overview', id: null }; G.pos = {}; G.settled = false; G.sel = null; commit(); break;
      case 'fcancel': closeForm(); break;
      case 'fdel': { var mf = document.querySelector('.mf>div'); mf.innerHTML = '<span class="muted" style="font-size:13px">Delete this habit? Sub-skills move up one level.</span> <button type="button" class="btn dng sm" data-act="fdelok">Yes, delete</button>'; break; }
      case 'fdelok': deleteHabit(form.id); break;
      case 'gfit': gFit(); break;
      case 'gzin': gZoom(1.3); break;
      case 'gzout': gZoom(1 / 1.3); break;
    }
  });
  document.addEventListener('submit', function (e) { if (e.target.id === 'hform') { e.preventDefault(); saveForm(); } });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.hasAttribute && t.hasAttribute('data-amt')) setAmount(t.getAttribute('data-amt'), TODAY, t.value);
    else if (t.id === 'f-parent') syncHint();
    else if (t.id === 'f-ch') $('#f-chbox').hidden = !t.checked;
    else if (t.getAttribute && t.getAttribute('data-g')) { var k = t.getAttribute('data-g'); G[k] = t.checked; if (k === 'links') gKick(.5); else gRedraw(); }
  });
  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t.hasAttribute && t.hasAttribute('data-note')) { var h = S.habits[t.getAttribute('data-note')]; if (h) { h.note = t.value; S.updated = Date.now(); persist(); } }
    if (t.id === 'f-name') $('#f-err').hidden = true;
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { if (!$('#modal').hidden) closeForm(); else if (!pop.hidden) closePop(); else closeSide(); }
    else if (e.key === 'Enter' && e.target.id === 'pop-amt') { var b = document.querySelector('[data-act="pset"]'); if (b) b.click(); }
    else if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('hc')) { e.preventDefault(); e.target.click(); }
  });
  document.addEventListener('mouseover', function (e) {
    var c = e.target.closest && e.target.closest('[data-d]');
    if (!c) { hideTip(); return; }
    var r = c.getBoundingClientRect();
    showTip(dayInfo(c.getAttribute('data-id'), Number(c.getAttribute('data-d'))), r.left + r.width / 2, r.top);
  });
  document.addEventListener('scroll', hideTip, true);
  document.addEventListener('visibilitychange', function () { if (!document.hidden && todayNum() !== TODAY) render(); });

  /* ---------- boot ---------- */
  S = loadLocal() || sampleState();
  reindex();
  render();
  connect();
})();
