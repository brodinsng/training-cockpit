/* ============================================================================
   Training Cockpit — app layer (skin v2)
   A non-invasive layer over the base app. It:
     1. Repaints to a dark, high-contrast theme (CSS-variable override).
     2. Splits the one long page into real swappable views + a bottom tab bar.
     3. Adds a Settings sheet (calendar picker, hide-keywords, connections).
     4. Adds an AI Coach view (Cloudflare Workers AI via /api/u/ai).
     5. Applies each user's own hide-keywords (default none — testers unaffected).
   It never rewrites the app's data logic. Delete the <script src="/skin.js">
   line in index.html to fully revert.
   ============================================================================ */
(function () {
  'use strict';

  /* ---------------- preferences (per browser) ---------------- */
  function getPrefs() {
    try { return Object.assign({ hide: [] }, JSON.parse(localStorage.getItem('gid_prefs') || '{}')); }
    catch (e) { return { hide: [] }; }
  }
  function setPrefs(p) { try { localStorage.setItem('gid_prefs', JSON.stringify(p)); } catch (e) {} }

  /* ---------------- 1. dark theme + layout ---------------- */
  var css = `
    :root{
      color-scheme:dark !important;
      --bg:#0a0e13; --card:#141b24; --line:#242e3a; --ink:#e9eef4; --mut:#8a97a8;
      --sky:#12202c;
      --peacock:#38bdf8; --peacock2:#5cc9fb;
      --run:#ff9e42; --ride:#38bdf8; --swim:#22d3c5; --other:#9aa6b3;
      --good:#2ee08f; --warn:#f5b445; --bad:#ff5d52; --strava:#fc4c02;
    }
    html,body{background:var(--bg) !important;color:var(--ink);}
    body{padding-top:60px !important;padding-bottom:92px !important;
      -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;}
    .wrap{max-width:640px;}
    .card{background:var(--card) !important;border:1px solid var(--line) !important;
      border-radius:18px !important;box-shadow:0 1px 0 rgba(255,255,255,.02) inset;}
    h2{color:var(--mut) !important;font-size:12px !important;letter-spacing:1.6px !important;
      margin:22px 6px 12px !important;}
    .sub,.muted,.loading{color:var(--mut) !important;}
    .wrap h1{display:none !important;}
    .gauge .big{font-size:46px !important;font-weight:800 !important;letter-spacing:-1px !important;line-height:1 !important;}
    .gauge .cap{color:var(--mut) !important;letter-spacing:1px;}
    .rk .v{font-size:26px !important;font-weight:800 !important;}
    input,textarea,select{background:#0e151d !important;color:var(--ink) !important;
      border:1px solid var(--line) !important;border-radius:10px !important;}
    input::placeholder,textarea::placeholder{color:#5c6a7a !important;}
    .addform button,.genbtn,button{border-radius:10px !important;}
    .chk .seg button{background:#0e151d !important;color:var(--ink) !important;border:1px solid var(--line) !important;border-radius:9px !important;}
    .chk .seg button.on{background:var(--peacock) !important;border-color:var(--peacock) !important;color:#06121b !important;font-weight:800 !important;}
    .chk, .chk .lbl, .chk .lbl *{color:var(--ink) !important;}
    .state,.verdict,.flag,#readi{background:#10171f !important;color:var(--ink) !important;border:1px solid var(--line) !important;border-left:3px solid var(--peacock) !important;}
    .flag{border-left-color:var(--warn) !important;}
    .stat,.sess,.todo,.meal,.vol{border-color:var(--line) !important;}
    .track{background:#0e151d !important;}
    .u{background:var(--sky) !important;}
    .mini{background:#0e151d !important;border-color:var(--line) !important;color:var(--mut) !important;}
    #statusbar{font-size:12px;}
    /* header */
    #skinHeader{position:fixed;top:0;left:0;right:0;height:56px;z-index:50;display:flex;align-items:center;gap:10px;padding:8px 16px;
      background:rgba(10,14,19,.85);backdrop-filter:saturate(160%) blur(14px);-webkit-backdrop-filter:saturate(160%) blur(14px);border-bottom:1px solid var(--line);}
    #skinHeader .tw{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;}
    #skinHeader .t{font-size:16px;font-weight:800;letter-spacing:.3px;color:var(--ink);display:flex;align-items:center;gap:8px;}
    #skinHeader .dot{width:7px;height:7px;border-radius:50%;background:var(--good);box-shadow:0 0 8px var(--good);}
    #skinHeader .s{font-size:11px;color:var(--mut);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    #gvGear{flex:none;width:34px;height:34px;border-radius:50%;border:1px solid var(--line);background:#0e151d;color:var(--ink);font-size:16px;cursor:pointer;}
    /* views */
    .gv-view{display:none;}
    .gv-view.on{display:block;animation:gvIn .18s ease;}
    @keyframes gvIn{from{opacity:.4;transform:translateY(4px)}to{opacity:1;transform:none}}
    /* bottom tabs */
    #skinTabs{position:fixed;left:0;right:0;bottom:0;z-index:50;display:flex;
      background:rgba(10,14,19,.92);backdrop-filter:saturate(160%) blur(14px);-webkit-backdrop-filter:saturate(160%) blur(14px);
      border-top:1px solid var(--line);padding:6px 4px calc(6px + env(safe-area-inset-bottom));}
    #skinTabs button{flex:1;background:none !important;border:none !important;display:flex;flex-direction:column;align-items:center;gap:3px;
      padding:6px 0 !important;color:var(--mut) !important;font-size:10px !important;font-weight:700 !important;letter-spacing:.3px;cursor:pointer;transition:color .15s;}
    #skinTabs button .ic{font-size:19px;line-height:1;}
    #skinTabs button.on{color:var(--peacock) !important;}
    #skinTabs button.on .ic{filter:drop-shadow(0 0 6px rgba(56,189,248,.5));}
    /* settings sheet */
    #gvSheet{position:fixed;inset:0;z-index:60;background:rgba(4,7,10,.6);display:none;}
    #gvSheet.on{display:block;}
    #gvSheet .panel{position:absolute;left:0;right:0;bottom:0;max-height:86vh;overflow:auto;background:var(--card);
      border-top:1px solid var(--line);border-radius:20px 20px 0 0;padding:18px 18px calc(24px + env(safe-area-inset-bottom));}
    #gvSheet h3{font-size:15px;margin:0 0 4px;color:var(--ink);}
    #gvSheet .row{margin:16px 0 0;}
    #gvSheet label{display:block;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:var(--mut);margin-bottom:7px;}
    #gvSheet select,#gvSheet input{width:100%;padding:11px 12px;font-size:14px;}
    #gvSheet .gvbtn{background:var(--peacock);color:#06121b;border:none;border-radius:10px;padding:11px 16px;font-weight:800;font-size:14px;cursor:pointer;}
    #gvSheet .link{color:var(--peacock);text-decoration:none;font-size:13px;}
    #gvSheet .close{position:absolute;top:12px;right:14px;background:none;border:none;color:var(--mut);font-size:22px;cursor:pointer;}
    #gvSheet .hint{color:var(--mut);font-size:12px;margin-top:6px;}
    /* AI coach */
    .gv-chat{display:flex;flex-direction:column;gap:10px;min-height:180px;max-height:52vh;overflow:auto;padding:4px 2px;}
    .gv-msg{max-width:88%;padding:10px 13px;border-radius:14px;font-size:14px;line-height:1.5;white-space:pre-wrap;overflow-wrap:break-word;}
    .gv-msg.user{align-self:flex-end;background:#1c2a3a;border-bottom-right-radius:4px;}
    .gv-msg.ai{align-self:flex-start;background:#10171f;border:1px solid var(--line);border-bottom-left-radius:4px;}
    .gv-compose{display:flex;gap:8px;margin-top:12px;}
    .gv-compose input{flex:1;}
    .gv-compose button{flex:none;background:var(--peacock);color:#06121b;border:none;border-radius:10px;padding:0 16px;font-weight:800;cursor:pointer;}
    .gv-dots span{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--peacock);opacity:.35;animation:gvb 1.1s infinite;margin:0 2px;}
    .gv-dots span:nth-child(2){animation-delay:.18s}.gv-dots span:nth-child(3){animation-delay:.36s}
    @keyframes gvb{0%,80%,100%{opacity:.25}40%{opacity:1}}
    .gv-intro{color:var(--mut);font-size:13px;line-height:1.6;}
  `;
  var st = document.createElement('style'); st.id = 'skin'; st.textContent = css; document.head.appendChild(st);
  var tc = document.querySelector('meta[name="theme-color"]'); if (tc) tc.setAttribute('content', '#0a0e13');

  /* ---------------- 2. Chart.js dark defaults ---------------- */
  function tuneCharts() {
    if (window.Chart && Chart.defaults) {
      Chart.defaults.color = '#93a1b2';
      Chart.defaults.borderColor = 'rgba(255,255,255,.06)';
      Chart.defaults.font = Chart.defaults.font || {};
      Chart.defaults.font.family = '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif';
      return true;
    }
    return false;
  }
  if (!tuneCharts()) { var tcN = 0, tcv = setInterval(function () { if (tuneCharts() || ++tcN > 40) clearInterval(tcv); }, 50); }

  /* ---------------- 3. per-user hide-keywords filter ---------------- */
  (function () {
    function install() {
      if (typeof window.isTrainingSession !== 'function') return false;
      if (window.__gidFilterHook) return true;
      var orig = window.isTrainingSession;
      window.isTrainingSession = function (e) {
        var nm = ((e && e.summary) || '').toLowerCase();
        var hide = getPrefs().hide || [];
        for (var i = 0; i < hide.length; i++) {
          var k = (hide[i] || '').trim().toLowerCase();
          if (k && nm.indexOf(k) > -1) return false;
        }
        return orig(e);
      };
      window.__gidFilterHook = true;
      return true;
    }
    window.__gidRerender = function () {
      try { window.renderSchedule && window.renderSchedule(); } catch (e) {}
      try { window.renderToday && window.renderToday(); } catch (e) {}
    };
    if (!install()) { var n = 0, iv = setInterval(function () { if (install() || ++n > 60) clearInterval(iv); }, 60); }
    setTimeout(window.__gidRerender, 1800);
    setTimeout(window.__gidRerender, 3400);
  })();

  /* ---------------- 4. header, views, tab bar, settings, coach ---------------- */
  var VIEWS = ['today', 'fitness', 'schedule', 'fuel', 'coach'];
  function viewFor(t) {
    t = (t || '').toLowerCase();
    if (/meal|fuel|grocery/.test(t)) return 'fuel';
    if (/what's next|schedule/.test(t)) return 'schedule';
    if (/coach.?s read|tailoring/.test(t)) return 'coach';
    if (/a-race|race countdown|today|check-in/.test(t)) return 'today';
    return 'fitness';
  }

  function showView(v) {
    VIEWS.forEach(function (k) {
      var el = document.getElementById('gv-' + k); if (el) el.classList.toggle('on', k === v);
      var b = document.getElementById('gvtab-' + k); if (b) b.classList.toggle('on', k === v);
    });
    window.scrollTo({ top: 0 });
    try { window.dispatchEvent(new Event('resize')); } catch (e) {}   // let charts re-fit when their view shows
  }

  function build() {
    try {
      /* header (once) */
      if (!document.getElementById('skinHeader')) {
        var header = document.createElement('div'); header.id = 'skinHeader';
        var tw = document.createElement('div'); tw.className = 'tw';
        var title = document.createElement('div'); title.className = 't';
        title.innerHTML = '<span class="dot"></span>Training Cockpit';
        tw.appendChild(title);
        var sub = document.getElementById('sub');
        if (sub) { sub.classList.add('s'); tw.appendChild(sub); sub.style.display = ''; }
        header.appendChild(tw);
        var gear = document.createElement('button'); gear.id = 'gvGear'; gear.innerHTML = '⚙'; gear.title = 'Settings';
        gear.addEventListener('click', openSheet);
        header.appendChild(gear);
        document.body.appendChild(header);
        buildSheet();
      }

      /* build views by grouping the cockpit's sections (once, when dashboard present) */
      var cockpit = document.getElementById('cockpit');
      if (cockpit && !cockpit.__gvBuilt) {
        var kids = Array.prototype.slice.call(cockpit.children);
        var firstH2 = -1;
        for (var i = 0; i < kids.length; i++) { if (kids[i].tagName === 'H2') { firstH2 = i; break; } }
        if (firstH2 > -1) {
          var groups = [], cur = null;
          for (var j = firstH2; j < kids.length; j++) {
            var el = kids[j];
            if (el.tagName === 'H2') { cur = { view: viewFor(el.textContent), nodes: [el] }; groups.push(cur); }
            else if (cur) { cur.nodes.push(el); }
          }
          if (groups.length) {
            var vc = {};
            VIEWS.forEach(function (v) { var d = document.createElement('div'); d.className = 'gv-view'; d.id = 'gv-' + v; vc[v] = d; });
            groups.forEach(function (g) { g.nodes.forEach(function (n) { vc[g.view].appendChild(n); }); });
            vc.coach.insertBefore(coachUI(), vc.coach.firstChild);
            VIEWS.forEach(function (v) { cockpit.appendChild(vc[v]); });
            cockpit.__gvBuilt = true;
            buildTabs();
            showView('today');
            mountCoach();
          }
        }
      }
    } catch (e) { /* best-effort; base app still works */ }
  }

  function buildTabs() {
    if (document.getElementById('skinTabs')) return;
    var defs = [['today', '◎', 'Today'], ['fitness', '📈', 'Fitness'], ['schedule', '🗓', 'Schedule'], ['fuel', '🍽', 'Fuel'], ['coach', '✦', 'Coach']];
    var tabs = document.createElement('div'); tabs.id = 'skinTabs';
    defs.forEach(function (d) {
      var b = document.createElement('button'); b.id = 'gvtab-' + d[0];
      b.innerHTML = '<span class="ic">' + d[1] + '</span>' + d[2];
      b.addEventListener('click', function () { showView(d[0]); });
      tabs.appendChild(b);
    });
    document.body.appendChild(tabs);
  }

  /* ---------- settings sheet ---------- */
  function buildSheet() {
    if (document.getElementById('gvSheet')) return;
    var sheet = document.createElement('div'); sheet.id = 'gvSheet';
    sheet.innerHTML =
      '<div class="panel">' +
        '<button class="close" aria-label="Close">×</button>' +
        '<h3>Settings</h3>' +
        '<div class="row"><label>Your training calendar</label>' +
          '<select id="gvCalSel"><option>Loading…</option></select>' +
          '<div style="margin-top:10px"><button class="gvbtn" id="gvCalSave">Use this calendar</button></div>' +
          '<div class="hint">Pick the Google calendar your sessions live on. It only reads it.</div>' +
        '</div>' +
        '<div class="row"><label>Hide events containing</label>' +
          '<input id="gvHide" placeholder="e.g. mma, yoga, work">' +
          '<div style="margin-top:10px"><button class="gvbtn" id="gvHideSave">Save</button></div>' +
          '<div class="hint">Comma-separated words. Any session whose name contains one is hidden. Leave blank to show everything.</div>' +
        '</div>' +
        '<div class="row"><label>Connections</label><div id="gvConns" class="hint">…</div></div>' +
      '</div>';
    document.body.appendChild(sheet);
    sheet.addEventListener('click', function (e) { if (e.target === sheet) closeSheet(); });
    sheet.querySelector('.close').addEventListener('click', closeSheet);
    sheet.querySelector('#gvHideSave').addEventListener('click', function () {
      var p = getPrefs(); p.hide = (document.getElementById('gvHide').value || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      setPrefs(p); window.__gidRerender && window.__gidRerender();
      var b = this; var t = b.textContent; b.textContent = 'Saved ✓'; setTimeout(function () { b.textContent = t; }, 1200);
    });
    sheet.querySelector('#gvCalSave').addEventListener('click', function () {
      var id = document.getElementById('gvCalSel').value; if (!id) return;
      var b = this; b.textContent = 'Saving…';
      fetch('/api/u/setcal?id=' + encodeURIComponent(id), { cache: 'no-store' }).then(function () { location.reload(); })
        .catch(function () { b.textContent = 'Use this calendar'; });
    });
  }
  function openSheet() {
    var s = document.getElementById('gvSheet'); if (!s) return;
    document.getElementById('gvHide').value = (getPrefs().hide || []).join(', ');
    // connections
    fetch('/api/me', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (m) {
      document.getElementById('gvConns').innerHTML =
        'Strava ' + (m.strava ? '✓ connected' : '<a class="link" href="/api/auth/strava">connect</a>') + ' &nbsp;·&nbsp; ' +
        'Google ' + (m.google ? '✓ connected' : '<a class="link" href="/api/auth/google">connect</a>') +
        '<br><a class="link" href="/api/logout">Disconnect / switch accounts</a>';
    }).catch(function () {});
    // calendar list
    var sel = document.getElementById('gvCalSel'); sel.innerHTML = '<option>Loading…</option>';
    fetch('/api/u/calendars', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) {
      var cals = d.calendars || [];
      if (!cals.length) { sel.innerHTML = '<option value="primary">My main calendar</option>'; return; }
      sel.innerHTML = cals.map(function (c) {
        var seld = (c.id === d.current) ? ' selected' : '';
        return '<option value="' + c.id.replace(/"/g, '&quot;') + '"' + seld + '>' + (c.summary || c.id).replace(/</g, '&lt;') + (c.primary ? ' (main)' : '') + '</option>';
      }).join('');
    }).catch(function () { sel.innerHTML = '<option value="primary">My main calendar</option>'; });
    s.classList.add('on');
  }
  function closeSheet() { var s = document.getElementById('gvSheet'); if (s) s.classList.remove('on'); }

  /* ---------- AI coach ---------- */
  function coachUI() {
    var w = document.createElement('div');
    w.innerHTML =
      '<h2>AI Coach</h2>' +
      '<div class="card">' +
        '<div class="gv-intro" id="gvIntro">Tell your coach your goals, constraints or what you want changed — it reads your live cockpit data and tailors advice to you. e.g. “I can only train 4 days a week” or “focus me on the 70.3”.</div>' +
        '<div class="gv-chat" id="gvChat"></div>' +
        '<div class="gv-compose"><input id="gvInput" placeholder="Message your coach…" autocomplete="off"><button id="gvSend">Send</button></div>' +
      '</div>';
    return w;
  }
  function chatHistory() { try { return JSON.parse(localStorage.getItem('gid_chat') || '[]'); } catch (e) { return []; } }
  function saveChat(h) { try { localStorage.setItem('gid_chat', JSON.stringify(h.slice(-40))); } catch (e) {} }
  function coachContext() {
    function grab(sel, n) { return Array.prototype.slice.call(document.querySelectorAll(sel)).map(function (e) { return (e.textContent || '').trim().replace(/\s+/g, ' '); }).slice(0, n); }
    var g = grab('.gauge .big', 3), caps = grab('.gauge .cap', 3);
    var fff = g.map(function (v, i) { return (caps[i] || '') + ': ' + v; });
    return {
      fitness_fatigue_form: fff,
      upcoming_sessions: grab('#schedule .stitle', 8),
      last7: grab('#weekStats .sname, #weekStats .sval', 8),
      hide_keywords: getPrefs().hide || []
    };
  }
  function addMsg(role, text) {
    var chat = document.getElementById('gvChat'); if (!chat) return null;
    var d = document.createElement('div'); d.className = 'gv-msg ' + (role === 'user' ? 'user' : 'ai'); d.textContent = text;
    chat.appendChild(d); chat.scrollTop = chat.scrollHeight; return d;
  }
  function mountCoach() {
    var input = document.getElementById('gvInput'), send = document.getElementById('gvSend'), chat = document.getElementById('gvChat');
    if (!input || !send || send.__wired) return;
    send.__wired = true;
    chatHistory().forEach(function (m) { addMsg(m.role, m.content); });
    function go() {
      var text = (input.value || '').trim(); if (!text || send.disabled) return;
      var intro = document.getElementById('gvIntro'); if (intro) intro.style.display = 'none';
      input.value = ''; addMsg('user', text);
      var hist = chatHistory(); hist.push({ role: 'user', content: text }); saveChat(hist);
      send.disabled = true;
      var dots = addMsg('ai', ''); if (dots) dots.innerHTML = '<span class="gv-dots"><span></span><span></span><span></span></span>';
      fetch('/api/u/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, context: coachContext(), history: hist.slice(-6) }) })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          var reply = d.reply || d.error || 'No reply.';
          if (dots) { dots.innerHTML = ''; dots.textContent = reply; }
          var h = chatHistory(); h.push({ role: 'assistant', content: reply }); saveChat(h);
          var c = document.getElementById('gvChat'); if (c) c.scrollTop = c.scrollHeight;
        })
        .catch(function () { if (dots) dots.textContent = 'Could not reach the coach. Try again.'; })
        .finally(function () { send.disabled = false; input.focus(); });
    }
    send.addEventListener('click', go);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); go(); } });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
  setTimeout(build, 1000);
  setTimeout(build, 2600);
})();
