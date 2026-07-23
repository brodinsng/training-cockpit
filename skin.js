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
  function getProfile() { try { return Object.assign({ sports: [], done: false }, JSON.parse(localStorage.getItem('gid_profile') || '{}')); } catch (e) { return { sports: [], done: false }; } }
  function setProfile(p) { try { localStorage.setItem('gid_profile', JSON.stringify(p)); } catch (e) {} }
  function isCyclist() { var s = getProfile().sports || []; return s.indexOf('Cycling') > -1 || s.indexOf('Triathlon') > -1; }

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
    /* bigger coach box */
    .gv-compose{align-items:stretch;}
    .gv-compose textarea{flex:1;min-height:66px;max-height:170px;resize:vertical;padding:11px 12px;font:inherit;line-height:1.45;}
    .gv-compose button{align-self:stretch;padding:0 18px;}
    /* colour swatches in settings */
    .gvsw{display:flex;flex-wrap:wrap;gap:9px;margin-top:2px;}
    .gvsw .sw{display:flex;align-items:center;gap:6px;padding:7px 11px;border:1px solid var(--line);border-radius:10px;background:#0e151d;color:var(--ink);font-size:12px;cursor:pointer;}
    .gvsw .sw .dotc{width:13px;height:13px;border-radius:50%;border:1px solid rgba(255,255,255,.25);}
    .gvsw .sw.on{border-color:var(--peacock);box-shadow:0 0 0 1px var(--peacock) inset;}
    /* structured meal prep */
    .gvmeal{background:#10171f;border:1px solid var(--line);border-radius:14px;padding:12px 14px;margin-bottom:10px;}
    .gvmeal-day{font-weight:800;color:var(--peacock);font-size:12px;letter-spacing:1.4px;margin-bottom:6px;text-transform:uppercase;}
    .gvmeal label{display:block;font-size:11px;color:var(--mut);margin:8px 0 3px;}
    .gvmeal input{width:100%;padding:9px 11px;font-size:13px;}
    /* today's AI plan */
    #gidPlan{margin-bottom:14px;}
    .gidplan-h{display:flex;align-items:center;justify-content:space-between;font-size:12px;letter-spacing:1.4px;text-transform:uppercase;color:var(--peacock);font-weight:800;margin-bottom:10px;}
    .gidplan-refresh{background:#0e151d !important;border:1px solid var(--line) !important;color:var(--mut) !important;border-radius:8px !important;padding:4px 9px !important;font-size:13px;cursor:pointer;}
    .gidplan-item{display:flex;align-items:center;gap:10px;padding:11px 0;border-bottom:1px solid var(--line);}
    .gidplan-item:last-child{border-bottom:none;}
    .gidplan-txt{flex:1;font-size:14px;line-height:1.4;}
    .gidplan-item.done .gidplan-txt{opacity:.5;text-decoration:line-through;}
    .gidplan-item.skip .gidplan-txt{opacity:.4;}
    .gidplan-btns{display:flex;gap:6px;flex:none;}
    .gidplan-btns button{background:#0e151d !important;border:1px solid var(--line) !important;color:var(--mut) !important;border-radius:8px !important;padding:6px 10px !important;font-size:12px;font-weight:700;cursor:pointer;}
    .gidplan-btns button.on{background:var(--peacock) !important;border-color:var(--peacock) !important;color:#06121b !important;}
    .gidplan-loading{color:var(--mut);font-size:13px;padding:6px 0;}
    /* onboarding / profile */
    #gvOnboard{position:fixed;inset:0;z-index:70;background:var(--bg);display:none;overflow:auto;}
    #gvOnboard.on{display:block;}
    #gvOnboard .ob{max-width:520px;margin:0 auto;padding:46px 20px 44px;}
    #gvOnboard .obh{color:var(--ink);font-size:23px;font-weight:800;letter-spacing:-.4px;margin:0 0 6px;}
    #gvOnboard .obsub{color:var(--mut);font-size:14px;margin-bottom:20px;line-height:1.5;}
    #gvOnboard label{display:block;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:var(--mut);margin:20px 0 8px;}
    #gvOnboard input,#gvOnboard select,#gvOnboard textarea{width:100%;padding:12px;font-size:15px;}
    #gvOnboard .chips{display:flex;flex-wrap:wrap;gap:8px;}
    #gvOnboard .chip{padding:9px 14px;border:1px solid var(--line);border-radius:11px;background:#0e151d;color:var(--ink);font-size:13px;cursor:pointer;user-select:none;}
    #gvOnboard .chip.on{background:var(--peacock);color:#06121b;border-color:var(--peacock);font-weight:800;}
    #gvOnboard .two{display:flex;gap:10px;}
    #gvOnboard .two>div{flex:1;}
    #gvOnboard .obgo{margin-top:28px;width:100%;background:var(--peacock);color:#06121b;border:none;border-radius:12px;padding:15px;font-weight:800;font-size:15px;cursor:pointer;}
    #gvOnboard .obskip{display:block;text-align:center;margin-top:14px;color:var(--mut);font-size:13px;cursor:pointer;background:none;border:none;width:100%;}
    #gvFtp.gvhide{display:none !important;}
    /* weather */
    #gidWx{margin-bottom:14px;}
    .wx-h{display:flex;align-items:center;justify-content:space-between;font-size:12px;letter-spacing:1.4px;text-transform:uppercase;color:var(--peacock);font-weight:800;margin-bottom:12px;}
    .wx-now{display:flex;align-items:center;gap:14px;}
    .wx-ico{font-size:40px;line-height:1;}
    .wx-temp{font-size:34px;font-weight:800;letter-spacing:-1px;line-height:1;}
    .wx-meta{flex:1;color:var(--mut);font-size:12px;line-height:1.5;}
    .wx-cond{color:var(--ink);font-size:14px;font-weight:600;margin-bottom:2px;}
    .wx-hours{display:flex;gap:8px;margin-top:14px;overflow-x:auto;padding-bottom:2px;}
    .wx-hr{flex:none;text-align:center;background:#10171f;border:1px solid var(--line);border-radius:12px;padding:9px 11px;min-width:52px;}
    .wx-hr .h{font-size:11px;color:var(--mut);}
    .wx-hr .e{font-size:18px;margin:3px 0;}
    .wx-hr .t{font-size:13px;font-weight:700;}
    .wx-hr .p{font-size:10px;color:var(--ride);height:12px;}
    .wx-loading,.wx-err{color:var(--mut);font-size:13px;padding:4px 0;}
    .wx-refresh{background:#0e151d !important;border:1px solid var(--line) !important;color:var(--mut) !important;border-radius:8px !important;padding:4px 9px !important;font-size:13px;cursor:pointer;}
    /* meal restriction banner */
    .gvmeal-diet{font-size:12px;color:var(--mut);margin-bottom:10px;padding:9px 11px;background:#10171f;border:1px solid var(--line);border-left:3px solid var(--good) !important;border-radius:10px;display:flex;align-items:center;justify-content:space-between;gap:8px;}
    .gvmeal-diet b{color:var(--ink);}
    /* weekly plan → calendar */
    #gidWeek{margin-bottom:14px;}
    .gw-h{display:flex;align-items:center;justify-content:space-between;font-size:12px;letter-spacing:1.4px;text-transform:uppercase;color:var(--peacock);font-weight:800;margin-bottom:6px;}
    .gw-sub{color:var(--mut);font-size:12px;line-height:1.5;margin-bottom:12px;}
    .gw-row{display:flex;align-items:center;gap:11px;padding:9px 0;border-bottom:1px solid var(--line);}
    .gw-row:last-child{border-bottom:none;}
    .gw-day{flex:none;width:42px;font-size:11px;font-weight:800;color:var(--mut);letter-spacing:.5px;text-transform:uppercase;line-height:1.25;}
    .gw-dot{flex:none;width:9px;height:9px;border-radius:50%;}
    .gw-body{flex:1;min-width:0;}
    .gw-title{font-size:14px;font-weight:600;color:var(--ink);}
    .gw-meta{font-size:12px;color:var(--mut);margin-top:1px;}
    .gw-rest .gw-title{color:var(--mut);font-weight:500;}
    .gw-actions{display:flex;gap:9px;margin-top:14px;flex-wrap:wrap;}
    .gw-btn{flex:1;min-width:150px;background:var(--peacock);color:#06121b;border:none;border-radius:11px;padding:12px 14px;font-weight:800;font-size:14px;cursor:pointer;}
    .gw-btn.ghost{background:#0e151d;color:var(--ink);border:1px solid var(--line);font-weight:700;}
    .gw-btn:disabled{opacity:.5;cursor:default;}
    .gw-note{font-size:12px;line-height:1.5;margin-top:12px;padding:10px 12px;border-radius:10px;background:#10171f;border:1px solid var(--line);border-left:3px solid var(--peacock) !important;color:var(--ink);}
    .gw-note.warn{border-left-color:var(--warn) !important;}
    .gw-note a{color:var(--peacock);font-weight:700;}
    .gw-loading{color:var(--mut);font-size:13px;padding:6px 0;}
    /* connect-strava nudge */
    .gv-nudge{margin:0 0 6px;padding:12px 14px;border-radius:12px;background:#10171f;border:1px solid var(--line);border-left:3px solid var(--strava) !important;color:var(--ink);font-size:13px;line-height:1.5;}
    .gv-nudge a{color:var(--strava);font-weight:800;text-decoration:none;}
    /* header refresh button */
    #gvRefresh{flex:none;width:34px;height:34px;border-radius:50%;border:1px solid var(--line);background:#0e151d;color:var(--ink);font-size:17px;cursor:pointer;margin-right:8px;}
    #gvRefresh:active{transform:rotate(180deg);transition:transform .3s;}
    /* pull-to-refresh indicator */
    #gidPTR{position:fixed;top:10px;left:50%;transform:translateX(-50%) translateY(-46px);z-index:80;width:38px;height:38px;border-radius:50%;background:var(--card);border:1px solid var(--line);color:var(--peacock);display:flex;align-items:center;justify-content:center;font-size:19px;opacity:0;box-shadow:0 6px 18px rgba(0,0,0,.5);pointer-events:none;}
    #gidPTR.ready{color:var(--good);border-color:var(--good);}
    #gidPTR.spin .gidptr-i{animation:gidspin .7s linear infinite;}
    .gidptr-i{display:inline-block;}
    @keyframes gidspin{to{transform:rotate(360deg);}}
    /* install banner */
    #gidInstall{position:fixed;left:12px;right:12px;bottom:calc(102px + env(safe-area-inset-bottom));z-index:75;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:13px 15px;box-shadow:0 10px 28px rgba(0,0,0,.55);display:flex;flex-direction:column;gap:10px;animation:gvIn .2s ease;}
    #gidInstall .gi-txt{font-size:13px;line-height:1.55;color:var(--ink);}
    #gidInstall .gi-txt b{color:var(--peacock);}
    #gidInstall .gi-btns{display:flex;gap:8px;justify-content:flex-end;align-items:center;}
    #gidInstall .gi-go{background:var(--peacock);color:#06121b;border:none;border-radius:9px;padding:9px 16px;font-weight:800;font-size:13px;cursor:pointer;}
    #gidInstall .gi-x{background:#0e151d;color:var(--mut);border:1px solid var(--line);border-radius:9px;padding:9px 14px;font-size:13px;cursor:pointer;}
  `;
  var st = document.createElement('style'); st.id = 'skin'; st.textContent = css; document.head.appendChild(st);
  var tc = document.querySelector('meta[name="theme-color"]'); if (tc) tc.setAttribute('content', '#0a0e13');
  try { document.title = 'Cyprus'; } catch (e) {}   // renamed from Training Cockpit

  /* make /app/ installable as a PWA — the base page is missing these tags */
  [
    ['link', { rel: 'manifest', href: '/manifest.webmanifest' }],
    ['link', { rel: 'apple-touch-icon', href: '/icon-192.png' }],
    ['meta', { name: 'apple-mobile-web-app-capable', content: 'yes' }],
    ['meta', { name: 'mobile-web-app-capable', content: 'yes' }],
    ['meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' }],
    ['meta', { name: 'apple-mobile-web-app-title', content: 'Cyprus' }]
  ].forEach(function (d) {
    var key = d[1].rel ? '[rel="' + d[1].rel + '"]' : '[name="' + d[1].name + '"]';
    if (document.head.querySelector(d[0] + key)) return;
    var el = document.createElement(d[0]);
    for (var k in d[1]) el.setAttribute(k, d[1][k]);
    document.head.appendChild(el);
  });

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
        var p = getPrefs();
        var nm = ((e && e.summary) || '').toLowerCase();
        // the app's own synced plan events always count as training (bypass hide/colour filters)
        if (nm.indexOf('cyprus') > -1) return true;
        var hide = p.hide || [];
        for (var i = 0; i < hide.length; i++) {
          var k = (hide[i] || '').trim().toLowerCase();
          if (k && nm.indexOf(k) > -1) return false;
        }
        // colour ownership: if "my colours" chosen, only those calendar colours count as mine
        var show = p.showColors || [];
        if (show.length) {
          var c = (e && e.colorId != null) ? String(e.colorId) : '';
          if (show.indexOf(c) === -1) return false;
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
    // Charts created while their view was hidden render at zero size — resize + redraw them now.
    try {
      var view = document.getElementById('gv-' + v);
      if (view && window.Chart && Chart.getChart) {
        view.querySelectorAll('canvas').forEach(function (cv) {
          var ch = Chart.getChart(cv);
          if (ch) { try { ch.resize(); ch.update('none'); } catch (e) {} }
        });
      }
    } catch (e) {}
  }

  function build() {
    try {
      /* header (once) */
      if (!document.getElementById('skinHeader')) {
        var header = document.createElement('div'); header.id = 'skinHeader';
        var tw = document.createElement('div'); tw.className = 'tw';
        var title = document.createElement('div'); title.className = 't';
        title.innerHTML = '<span class="dot"></span>Cyprus';
        tw.appendChild(title);
        var sub = document.getElementById('sub');
        if (sub) { sub.classList.add('s'); tw.appendChild(sub); sub.style.display = ''; }
        header.appendChild(tw);
        var refresh = document.createElement('button'); refresh.id = 'gvRefresh'; refresh.innerHTML = '↻'; refresh.title = 'Refresh';
        refresh.addEventListener('click', function () { gidRefreshApp(); });
        header.appendChild(refresh);
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
            // today's AI plan at the top of the Today view
            var todayView = document.getElementById('gv-today');
            if (todayView && !document.getElementById('gidPlan')) {
              var pc = document.createElement('div'); pc.className = 'card'; pc.id = 'gidPlan';
              todayView.insertBefore(pc, todayView.firstChild);
              gidEnsurePlan(false);
            }
            // weather card ABOVE the plan (very top of Today)
            if (todayView && !document.getElementById('gidWx')) {
              var wc = document.createElement('div'); wc.className = 'card'; wc.id = 'gidWx';
              todayView.insertBefore(wc, todayView.firstChild);
              gidEnsureWeather(false);
            }
            // weekly plan → Google Calendar card at the top of the Schedule view
            var schedView = document.getElementById('gv-schedule');
            if (schedView && !document.getElementById('gidWeek')) {
              var gwc = document.createElement('div'); gwc.className = 'card'; gwc.id = 'gidWeek';
              schedView.insertBefore(gwc, schedView.firstChild);
              gwRender();
            }
            gidPolish();
            // structured meal prep + working AI generation
            window.renderMeals = gidRenderMeals;
            window.generateMeals = gidGenerateMeals;
            gidRenderMeals();
            // profile: fill metrics, hide FTP for non-cyclists, run onboarding first time
            applyProfile();
            if (!getProfile().done) showOnboard();
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
        '<div class="row"><label>Show only my calendar colours</label>' +
          '<div class="gvsw" id="gvColors"></div>' +
          '<div class="hint">Tap the colours you use for <b>your</b> sessions. Then only those count as yours — the fix for a shared calendar where a partner\'s runs are named the same but a different colour. Leave all off to show every colour.</div>' +
        '</div>' +
        '<div class="row"><label>Your profile</label><button class="gvbtn" id="gvEditProfile">Edit sport, metrics &amp; diet</button>' +
          '<div class="hint">Your sport, goal, height/weight, FTP and dietary needs — drives your plan and meal tailoring.</div></div>' +
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
    sheet.querySelector('#gvEditProfile').addEventListener('click', function () { closeSheet(); showOnboard(); });
    sheet.querySelector('#gvCalSave').addEventListener('click', function () {
      var id = document.getElementById('gvCalSel').value; if (!id) return;
      var b = this; b.textContent = 'Saving…';
      fetch('/api/u/setcal?id=' + encodeURIComponent(id), { cache: 'no-store' }).then(function () { location.reload(); })
        .catch(function () { b.textContent = 'Use this calendar'; });
    });
  }
  // Google Calendar colours (id → label, hex). '' = the calendar's default colour.
  var GCOLORS = [
    ['', 'Default', '#7c8aa0'], ['7', 'Peacock', '#039be5'], ['9', 'Blueberry', '#3f51b5'],
    ['3', 'Grape', '#8e24aa'], ['1', 'Lavender', '#7986cb'], ['2', 'Sage', '#33b679'],
    ['10', 'Basil', '#0b8043'], ['5', 'Banana', '#f6bf26'], ['6', 'Tangerine', '#f4511e'],
    ['4', 'Flamingo', '#e67c73'], ['11', 'Tomato', '#d50000'], ['8', 'Graphite', '#616161']
  ];
  function renderColorSwatches() {
    var box = document.getElementById('gvColors'); if (!box) return;
    var sel = getPrefs().showColors || [];
    box.innerHTML = GCOLORS.map(function (c) {
      var on = sel.indexOf(c[0]) > -1 ? ' on' : '';
      return '<button class="sw' + on + '" data-c="' + c[0] + '"><span class="dotc" style="background:' + c[2] + '"></span>' + c[1] + '</button>';
    }).join('');
    box.querySelectorAll('.sw').forEach(function (b) {
      b.addEventListener('click', function () {
        var c = b.getAttribute('data-c');
        var p = getPrefs(); var s = p.showColors || [];
        var i = s.indexOf(c);
        if (i > -1) s.splice(i, 1); else s.push(c);
        p.showColors = s; setPrefs(p);
        b.classList.toggle('on');
        window.__gidRerender && window.__gidRerender();
      });
    });
  }

  function openSheet() {
    var s = document.getElementById('gvSheet'); if (!s) return;
    document.getElementById('gvHide').value = (getPrefs().hide || []).join(', ');
    renderColorSwatches();
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
        '<div class="gv-compose"><textarea id="gvInput" rows="3" placeholder="Message your coach…  (Enter to send, Shift+Enter for a new line)"></textarea><button id="gvSend">Send</button></div>' +
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
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go(); } });
  }

  function esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  /* ---- structured meal prep: Breakfast / Lunch / Dinner on their own lines ---- */
  function gidRenderMeals() {
    try {
      var box = document.getElementById('meals'); if (!box) return;
      var DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      var m = {}; try { m = JSON.parse(localStorage.getItem('gideon_meals') || '{}'); } catch (e) {}
      function parse(s) {
        s = s || ''; var o = { b: '', l: '', d: '' };
        var mb = s.match(/B\s*[:\-]\s*([^/|\n]*)/i), ml = s.match(/L\s*[:\-]\s*([^/|\n]*)/i), md = s.match(/D\s*[:\-]\s*([^/|\n]*)/i);
        if (mb) o.b = mb[1].trim(); if (ml) o.l = ml[1].trim(); if (md) o.d = md[1].trim();
        if (!mb && !ml && !md && s.trim()) o.b = s.trim();
        return o;
      }
      var diet = (getProfile().diet || '').trim();
      var banner = diet
        ? '<div class="gvmeal-diet"><span>Tailored to: <b>' + esc(diet) + '</b></span><button class="wx-refresh" id="gidMealRebuild" title="Rebuild meals for these restrictions">↻ rebuild</button></div>'
        : '';
      box.innerHTML = banner + DAYS.map(function (d) {
        var p = parse(m[d]);
        return '<div class="gvmeal" data-day="' + d + '"><div class="gvmeal-day">' + d + '</div>'
          + '<label>🌅 Breakfast</label><input class="gvm-b" value="' + esc(p.b) + '">'
          + '<label>☀️ Lunch</label><input class="gvm-l" value="' + esc(p.l) + '">'
          + '<label>🌙 Dinner</label><input class="gvm-d" value="' + esc(p.d) + '"></div>';
      }).join('');
      var mrb = document.getElementById('gidMealRebuild');
      if (mrb) mrb.addEventListener('click', function () { gidGenerateMeals(); });
      box.querySelectorAll('.gvmeal').forEach(function (card) {
        card.querySelectorAll('input').forEach(function (inp) {
          inp.addEventListener('input', function () {
            var day = card.getAttribute('data-day');
            var b = card.querySelector('.gvm-b').value, l = card.querySelector('.gvm-l').value, dd = card.querySelector('.gvm-d').value;
            var mm = {}; try { mm = JSON.parse(localStorage.getItem('gideon_meals') || '{}'); } catch (e) {}
            mm[day] = 'B: ' + b + ' / L: ' + l + ' / D: ' + dd;
            try { localStorage.setItem('gideon_meals', JSON.stringify(mm)); } catch (e) {}
          });
        });
      });
    } catch (e) {}
  }

  /* ---- today's AI-tailored plan; refreshes for the new day (~3am rollover) ---- */
  function gidDayKey() { var d = new Date(Date.now() - 3 * 3600 * 1000); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }  // local-time 3am rollover (not UTC)
  function gidPlanContext() {
    function grab(sel, n) { return Array.prototype.slice.call(document.querySelectorAll(sel)).map(function (e) { return (e.textContent || '').trim().replace(/\s+/g, ' '); }).slice(0, n); }
    var g = grab('.gauge .big', 3), caps = grab('.gauge .cap', 3);
    var done = document.getElementById('todayDone');
    var readi = document.getElementById('readi');
    return {
      fitness_fatigue_form: g.map(function (v, i) { return (caps[i] || '') + ': ' + v; }),
      recent_7d: grab('#weekStats .sname, #weekStats .sval', 8),
      completed_today: done ? (done.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 300) : 'nothing logged yet today',
      daily_checkin: readi ? (readi.textContent || '').trim().slice(0, 160) : '',
      profile: getProfile(),
      weekday: new Date().toLocaleDateString('en-GB', { weekday: 'long' }),
      hide_keywords: getPrefs().hide || []
    };
  }
  function gidRenderPlan(plan) {
    var el = document.getElementById('gidPlan'); if (!el) return;
    var stt = plan.status || {};
    el.innerHTML = '<div class="gidplan-h"><span>Today\'s Plan · AI-tailored</span><button class="gidplan-refresh" id="gidPlanRefresh" title="Regenerate">↻</button></div>'
      + plan.sessions.map(function (s, i) {
        var dn = stt[i] === 'done', sk = stt[i] === 'skip';
        return '<div class="gidplan-item' + (dn ? ' done' : '') + (sk ? ' skip' : '') + '"><div class="gidplan-txt">' + esc(s) + '</div>'
          + '<div class="gidplan-btns"><button data-i="' + i + '" data-a="done" class="' + (dn ? 'on' : '') + '">✓</button>'
          + '<button data-i="' + i + '" data-a="skip" class="' + (sk ? 'on' : '') + '">⤫</button></div></div>';
      }).join('');
    var rb = el.querySelector('#gidPlanRefresh'); if (rb) rb.addEventListener('click', function () { gidEnsurePlan(true); });
    el.querySelectorAll('.gidplan-btns button').forEach(function (b) {
      b.addEventListener('click', function () {
        var i = b.getAttribute('data-i'), a = b.getAttribute('data-a');
        var p; try { p = JSON.parse(localStorage.getItem('gid_plan')); } catch (e) { return; }
        if (!p) return; p.status = p.status || {};
        p.status[i] = (p.status[i] === a) ? null : a;
        try { localStorage.setItem('gid_plan', JSON.stringify(p)); } catch (e) {}
        gidRenderPlan(p);
      });
    });
  }
  function gidEnsurePlan(force) {
    var el = document.getElementById('gidPlan'); if (!el) return;
    var key = gidDayKey(), plan = null;
    try { plan = JSON.parse(localStorage.getItem('gid_plan') || 'null'); } catch (e) {}
    if (!force && plan && plan.date === key && plan.sessions && plan.sessions.length) { gidRenderPlan(plan); return; }
    el.innerHTML = '<div class="gidplan-h"><span>Today\'s Plan · AI-tailored</span></div><div class="gidplan-loading"><span class="gv-dots"><span></span><span></span><span></span></span> building today\'s session…</div>';
    var prompt = "Create today's training plan for " + new Date().toLocaleDateString('en-GB', { weekday: 'long' }) +
      ". CRITICAL RULES: (1) Read 'completed_today' — if the athlete has ALREADY trained today, do NOT prescribe more of what they've done; if they've already done substantial work (e.g. a ride AND a run, or a long/hard session), the answer is REST or gentle recovery only — never add more load on top of an overloaded day. " +
      "(2) Respect 'daily_checkin' — amber/red readiness or poor sleep/soreness means easier or rest. (3) Tailor to the sports in 'profile' — never prescribe a sport they don't do. " +
      "Output ONLY session lines, each on its own line starting with '- ', format '- Sport Duration — focus'. If the right call is rest, output the single line '- Rest — you've trained enough today, recover.' No preamble, no other text.";
    fetch('/api/u/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: prompt, context: gidPlanContext(), history: [] }) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var lines = (d.reply || '').split('\n').map(function (s) { return s.replace(/^[\s\-•*\d.]+/, '').trim(); }).filter(function (s) { return s.length > 3 && !/^(here|today|your|based|okay|sure)/i.test(s); });
        if (!lines.length) { var t = (d.reply || 'Easy day — keep it aerobic.').trim(); lines = [t.slice(0, 160)]; }
        lines = lines.slice(0, 3);
        var np = { date: key, sessions: lines, status: (plan && plan.date === key ? plan.status : {}) || {} };
        try { localStorage.setItem('gid_plan', JSON.stringify(np)); } catch (e) {}
        gidRenderPlan(np);
      })
      .catch(function () {
        el.innerHTML = '<div class="gidplan-h"><span>Today\'s Plan</span><button class="gidplan-refresh" id="gidPlanRefresh">↻</button></div><div class="gidplan-loading">Could not build a plan — tap ↻ to retry.</div>';
        var rb2 = document.getElementById('gidPlanRefresh'); if (rb2) rb2.addEventListener('click', function () { gidEnsurePlan(true); });
      });
  }

  /* ---- profile: apply to metrics (fill + hide FTP for non-cyclists) ---- */
  function fire(el) { try { el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {} }
  function applyProfile() {
    try {
      var p = getProfile();
      var h = document.getElementById('pf_h'), w = document.getElementById('pf_w'), f = document.getElementById('pf_ftp');
      if (h && p.heightCm) { h.value = p.heightCm; fire(h); }
      if (w && p.weightKg) { w.value = p.weightKg; fire(w); }
      if (f && p.ftp) { f.value = p.ftp; fire(f); }
      if (f) { var box = f.closest('.metric'); if (box) { var hideFtp = p.done && (p.sports || []).length > 0 && !isCyclist(); box.style.display = hideFtp ? 'none' : ''; } }
    } catch (e) {}
  }

  /* ---- onboarding questionnaire ---- */
  var SPORTS = ['Running', 'Cycling', 'Swimming', 'Triathlon', 'Gym / Strength', 'Other'];
  var GOALS = ['General fitness', 'Endurance race', 'Weight loss', 'Build muscle', 'Stay maintained'];
  function buildOnboard() {
    if (document.getElementById('gvOnboard')) return;
    var p = getProfile();
    var d = document.createElement('div'); d.id = 'gvOnboard';
    d.innerHTML = '<div class="ob">'
      + '<div class="obh">Let\'s tailor this to you</div>'
      + '<div class="obsub">A few quick questions so your plan, metrics and nutrition fit <i>you</i> — not a generic template. About 20 seconds.</div>'
      + '<label>What do you train?</label><div class="chips" id="obSports">' + SPORTS.map(function (s) { return '<button class="chip' + ((p.sports || []).indexOf(s) > -1 ? ' on' : '') + '" data-v="' + s + '">' + s + '</button>'; }).join('') + '</div>'
      + '<label>Main goal</label><select id="obGoal">' + GOALS.map(function (g) { return '<option' + (p.goal === g ? ' selected' : '') + '>' + g + '</option>'; }).join('') + '</select>'
      + '<div class="two"><div><label>Sex</label><div class="chips" id="obSex">' + ['M', 'F', '—'].map(function (s) { return '<button class="chip' + (p.sex === s ? ' on' : '') + '" data-v="' + s + '">' + s + '</button>'; }).join('') + '</div></div>'
      + '<div><label>Age</label><input id="obAge" type="number" inputmode="numeric" placeholder="30" value="' + (p.age || '') + '"></div></div>'
      + '<div class="two"><div><label>Height (cm)</label><input id="obH" type="number" inputmode="numeric" placeholder="170" value="' + (p.heightCm || '') + '"></div>'
      + '<div><label>Weight (kg)</label><input id="obW" type="number" inputmode="numeric" placeholder="68" value="' + (p.weightKg || '') + '"></div></div>'
      + '<div id="obFtpRow" style="display:none"><label>FTP (watts) — cyclists only</label><input id="obFtp" type="number" inputmode="numeric" placeholder="200" value="' + (p.ftp || '') + '"></div>'
      + '<label>Dietary needs or foods to avoid</label><textarea id="obDiet" rows="2" placeholder="e.g. halal, no pork, vegetarian, nut allergy — or leave blank">' + esc(p.diet || '') + '</textarea>'
      + '<label>Training days per week</label><input id="obDays" type="number" inputmode="numeric" placeholder="4" value="' + (p.daysPerWeek || '') + '">'
      + '<button class="obgo" id="obGo">Build my cockpit</button>'
      + '<button class="obskip" id="obSkip">Skip for now</button>'
      + '</div>';
    document.body.appendChild(d);
    function bindChips(box, multi) {
      box.querySelectorAll('.chip').forEach(function (b) {
        b.addEventListener('click', function () {
          if (multi) b.classList.toggle('on');
          else { box.querySelectorAll('.chip').forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); }
          updFtp();
        });
      });
    }
    function updFtp() {
      var sel = Array.prototype.slice.call(d.querySelectorAll('#obSports .chip.on')).map(function (b) { return b.getAttribute('data-v'); });
      d.querySelector('#obFtpRow').style.display = (sel.indexOf('Cycling') > -1 || sel.indexOf('Triathlon') > -1) ? '' : 'none';
    }
    bindChips(d.querySelector('#obSports'), true);
    bindChips(d.querySelector('#obSex'), false);
    updFtp();
    d.querySelector('#obGo').addEventListener('click', saveOnboard);
    d.querySelector('#obSkip').addEventListener('click', function () { var pp = getProfile(); pp.done = true; setProfile(pp); hideOnboard(); });
  }
  function saveOnboard() {
    var d = document.getElementById('gvOnboard'); if (!d) return;
    var sports = Array.prototype.slice.call(d.querySelectorAll('#obSports .chip.on')).map(function (b) { return b.getAttribute('data-v'); });
    var sexBtn = d.querySelector('#obSex .chip.on');
    var num = function (id) { var v = parseFloat((d.querySelector(id) || {}).value); return isFinite(v) ? v : null; };
    var p = getProfile();
    var oldDiet = (p.diet || '').trim();
    p.sports = sports; p.goal = d.querySelector('#obGoal').value; p.sex = sexBtn ? sexBtn.getAttribute('data-v') : '';
    p.age = num('#obAge'); p.heightCm = num('#obH'); p.weightKg = num('#obW'); p.ftp = num('#obFtp');
    p.diet = (d.querySelector('#obDiet').value || '').trim(); p.daysPerWeek = num('#obDays');
    p.done = true; setProfile(p);
    hideOnboard(); applyProfile();
    try { localStorage.removeItem('gid_plan'); } catch (e) {}   // regenerate plan for the new profile
    var pel = document.getElementById('gidPlan'); if (pel) gidEnsurePlan(true);
    // if restrictions changed (or no meals yet), rebuild meals so they actually respect the diet
    var haveMeals = false; try { haveMeals = Object.keys(JSON.parse(localStorage.getItem('gideon_meals') || '{}')).length > 0; } catch (e) {}
    if (oldDiet !== p.diet || !haveMeals) { try { gidGenerateMeals(); } catch (e) {} }
    else { gidRenderMeals(); }
  }
  function showOnboard() { buildOnboard(); var d = document.getElementById('gvOnboard'); if (d) d.classList.add('on'); }
  function hideOnboard() { var d = document.getElementById('gvOnboard'); if (d) d.classList.remove('on'); }

  /* ---- tailored meal generation via Workers AI (replaces the app's stub) ---- */
  function gidGenerateMeals() {
    var btn = document.getElementById('mealgen'); var old = btn ? btn.textContent : '';
    if (btn) { btn.textContent = 'Thinking…'; btn.disabled = true; }
    var p = getProfile();
    var bmi = (p.heightCm && p.weightKg) ? (p.weightKg / Math.pow(p.heightCm / 100, 2)).toFixed(1) : '?';
    var prompt = "Design a 7-day meal plan (Mon to Sun) optimised for this athlete's nutrition. "
      + "Sports: " + ((p.sports || []).join(', ') || 'general fitness') + ". Goal: " + (p.goal || 'general fitness') + ". "
      + "Sex " + (p.sex || '?') + ", age " + (p.age || '?') + ", height " + (p.heightCm || '?') + "cm, weight " + (p.weightKg || '?') + "kg, BMI " + bmi + ". "
      + "HARD RULE — dietary restrictions: '" + (p.diet || 'none') + "'. You MUST NOT include ANY food, ingredient or drink that violates these restrictions anywhere in the 7 days. If a dish would breach them, replace it with a compliant alternative. This is non-negotiable and overrides everything else. "
      + "Rules: aim ~1.8-2g protein per kg bodyweight daily; more carbs on training days; realistic quick weeknight meals. "
      + "Output EXACTLY 7 lines, one per day, format 'Mon: B: <breakfast> / L: <lunch> / D: <dinner>'. No preamble, no other text.";
    fetch('/api/u/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: prompt, context: { profile: p }, history: [] }) })
      .then(function (r) { return r.json(); })
      .then(function (dd) {
        var m = {}; try { m = JSON.parse(localStorage.getItem('gideon_meals') || '{}'); } catch (e) {}
        (dd.reply || '').split('\n').forEach(function (line) {
          var dm = line.replace(/^[-•*\s]+/, '').match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w*\s*[:\-]\s*(.+)$/i);
          if (dm) m[dm[1].slice(0, 3).replace(/^\w/, function (c) { return c.toUpperCase(); })] = dm[2].trim();
        });
        try { localStorage.setItem('gideon_meals', JSON.stringify(m)); } catch (e) {}
        gidRenderMeals();
      })
      .catch(function () { alert('Could not generate meals — try again in a moment.'); })
      .finally(function () { if (btn) { btn.textContent = old || '✨ Suggest a week'; btn.disabled = false; } });
  }

  /* ---------------- weekly training plan → Google Calendar ---------------- */
  var GW_DOT = { run: '#ff9e42', ride: '#38bdf8', bike: '#38bdf8', cycl: '#38bdf8', swim: '#3f51b5', strength: '#f6bf26', gym: '#f6bf26', rest: '#616161' };
  function gwDot(sport) { var s = (sport || '').toLowerCase(); for (var k in GW_DOT) { if (s.indexOf(k) > -1) return GW_DOT[k]; } return '#33b679'; }
  function gwDates() { var out = [], base = new Date(); base.setHours(0, 0, 0, 0); for (var i = 0; i < 7; i++) out.push(new Date(base.getTime() + i * 864e5)); return out; }
  function gwYmd(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function gwTz() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { return 'UTC'; } }
  function gwGet() { try { return JSON.parse(localStorage.getItem('gid_week') || 'null'); } catch (e) { return null; } }
  function gwSet(w) { try { localStorage.setItem('gid_week', JSON.stringify(w)); } catch (e) {} }
  function gwParse(reply) {
    var dates = gwDates();
    var lines = (reply || '').split('\n').map(function (s) { return s.replace(/^[\s\-•*]+/, '').replace(/^day\s*\d+\s*[:\-]?\s*/i, '').trim(); }).filter(function (s) { return s.indexOf('|') > -1; });
    var out = [];
    for (var i = 0; i < 7 && i < lines.length; i++) {
      var parts = lines[i].split('|').map(function (x) { return x.trim(); });
      var sport = parts[0] || '', time = parts[1] || '', dur = parseInt(parts[2], 10), focus = parts[3] || '';
      if (!isFinite(dur)) dur = 60;
      var isRest = /rest|off\b/i.test(sport);
      if (!/^\d{1,2}:\d{2}$/.test(time)) time = '06:00';
      out.push({ date: gwYmd(dates[i]), dow: dates[i].toLocaleDateString('en-GB', { weekday: 'short' }), sport: sport, time: time, durationMin: isRest ? 0 : dur, focus: focus, rest: isRest });
    }
    return out;
  }
  function gwRender() {
    var el = document.getElementById('gidWeek'); if (!el) return;
    var w = gwGet();
    var head = '<div class="gw-h"><span>AI Training Week → Calendar</span></div>';
    if (!w || !w.sessions || !w.sessions.length) {
      el.innerHTML = head + '<div class="gw-sub">Generate a 7-day plan tailored to your sport, goal, fitness and fatigue — then add it straight to your Google Calendar. No manual entry.</div>'
        + '<div class="gw-actions"><button class="gw-btn" id="gwGen">✨ Generate my week</button></div>';
      var g = document.getElementById('gwGen'); if (g) g.addEventListener('click', gwGenerate);
      return;
    }
    var rows = w.sessions.map(function (s) {
      var meta = s.rest ? 'Recovery' : (s.time + ' · ' + s.durationMin + 'min' + (s.focus ? ' · ' + esc(s.focus) : ''));
      return '<div class="gw-row' + (s.rest ? ' gw-rest' : '') + '">'
        + '<div class="gw-day">' + esc(s.dow) + '</div>'
        + '<div class="gw-dot" style="background:' + gwDot(s.sport) + '"></div>'
        + '<div class="gw-body"><div class="gw-title">' + esc(s.rest ? 'Rest day' : (s.sport || 'Session')) + '</div><div class="gw-meta">' + meta + '</div></div></div>';
    }).join('');
    var synced = w.synced ? '<div class="gw-note">On your Google Calendar ✓ · ' + (w.syncedCount || 0) + ' sessions added. They also appear in your schedule below. Regenerating replaces them.</div>' : '';
    el.innerHTML = head + '<div class="gw-sub">Your plan for the next 7 days. Add it and it lands on your phone’s calendar automatically.</div>'
      + rows
      + '<div class="gw-actions"><button class="gw-btn" id="gwSync">📅 Add to Google Calendar</button><button class="gw-btn ghost" id="gwRegen">↻ Regenerate</button></div>'
      + '<div id="gwMsg"></div>' + synced
      + '<div class="gw-actions" style="margin-top:8px"><button class="gw-btn ghost" id="gwClear" style="min-width:auto;flex:none;font-size:12px;padding:8px 12px">Remove Cyprus sessions from calendar</button></div>';
    var sync = document.getElementById('gwSync'); if (sync) sync.addEventListener('click', function () { gwSync(); });
    var re = document.getElementById('gwRegen'); if (re) re.addEventListener('click', gwGenerate);
    var cl = document.getElementById('gwClear'); if (cl) cl.addEventListener('click', gwClear);
  }
  function gwGenerate() {
    var el = document.getElementById('gidWeek'); if (!el) return;
    el.innerHTML = '<div class="gw-h"><span>AI Training Week → Calendar</span></div><div class="gw-loading"><span class="gv-dots"><span></span><span></span><span></span></span> building your 7-day plan…</div>';
    var today = new Date().toLocaleDateString('en-GB', { weekday: 'long' });
    var prompt = "Create a 7-day training plan starting today (" + today + ", Day 1). Use the athlete's profile and current fitness in the context. "
      + "RULES: (1) Respect 'daysPerWeek' in the profile — include Rest days so the number of training days matches it (if unknown, give ~1-2 rest days). "
      + "(2) Only prescribe sports the athlete actually does (profile.sports); never invent a sport they don't do. "
      + "(3) Factor current fatigue/form — if fatigue is high or form negative, go easier; never stack two hard days back to back. "
      + "(4) Progress sensibly toward their race if one is set; vary intensity across the week. "
      + "OUTPUT EXACTLY 7 lines, one per day in order (Day 1 = today). Each line EXACTLY: 'SPORT | HH:MM | MINUTES | short focus'. "
      + "SPORT is ONE word (Run, Ride, Swim, Strength, or Rest). 24h times, sensible (default early morning). Rest day: 'Rest | 00:00 | 0 | recovery'. No preamble, no numbering, no other text.";
    fetch('/api/u/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: prompt, context: gidPlanContext(), history: [] }) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var sessions = gwParse(d.reply || '');
        if (!sessions.length) { el.innerHTML = '<div class="gw-h"><span>AI Training Week → Calendar</span></div><div class="gw-note warn">Could not build a plan just now. <a href="#" id="gwRetry">Try again</a></div>'; var rt = document.getElementById('gwRetry'); if (rt) rt.addEventListener('click', function (ev) { ev.preventDefault(); gwGenerate(); }); return; }
        gwSet({ sessions: sessions, synced: false, ts: Date.now() });
        gwRender();
      })
      .catch(function () { el.innerHTML = '<div class="gw-h"><span>AI Training Week → Calendar</span></div><div class="gw-note warn">Could not reach the planner. <a href="#" id="gwRetry">Try again</a></div>'; var rt = document.getElementById('gwRetry'); if (rt) rt.addEventListener('click', function (ev) { ev.preventDefault(); gwGenerate(); }); });
  }
  function gwSync() {
    var w = gwGet(); if (!w || !w.sessions) return;
    var msg = document.getElementById('gwMsg'), btn = document.getElementById('gwSync');
    if (btn) { btn.disabled = true; btn.textContent = 'Adding…'; }
    var toWrite = w.sessions.filter(function (s) { return !s.rest; });
    fetch('/api/u/calwrite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'sync', tz: gwTz(), sessions: toWrite }) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.needReconnect || d.error === 'need_write') { if (msg) msg.innerHTML = '<div class="gw-note warn">Cyprus needs permission to add to your calendar. <a href="/api/auth/google">Reconnect Google</a> (tap Allow), then Add again.</div>'; return; }
        if (d.needAuth) { if (msg) msg.innerHTML = '<div class="gw-note warn">Connect Google first — open Settings ⚙.</div>'; return; }
        w.synced = true; w.syncedCount = d.created || toWrite.length; gwSet(w);
        gwRender();
        try { window.__gidRerender && window.__gidRerender(); } catch (e) {}
      })
      .catch(function () { if (msg) msg.innerHTML = '<div class="gw-note warn">Could not reach the calendar. Try again.</div>'; })
      .finally(function () { if (btn) { btn.disabled = false; btn.textContent = '📅 Add to Google Calendar'; } });
  }
  function gwClear() {
    var msg = document.getElementById('gwMsg');
    fetch('/api/u/calwrite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'clear' }) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.needReconnect) { if (msg) msg.innerHTML = '<div class="gw-note warn"><a href="/api/auth/google">Reconnect Google</a> to manage calendar sessions.</div>'; return; }
        var w = gwGet(); if (w) { w.synced = false; w.syncedCount = 0; gwSet(w); }
        gwRender();
        try { window.__gidRerender && window.__gidRerender(); } catch (e) {}
      })
      .catch(function () {});
  }

  /* ---------------- small polish: stale copy + connect-Strava nudge ---------------- */
  function gidPolish() {
    try {
      var nodes = document.querySelectorAll('#cockpit p, #cockpit .sub, #cockpit small, #cockpit .muted');
      nodes.forEach(function (n) {
        if (/colou?r filters are coming|Calendar-writing/i.test(n.textContent)) {
          n.textContent = 'Sessions are read from your Google Calendar by name and colour. Use “AI Training Week” above to auto-add a plan to your calendar.';
        }
      });
    } catch (e) {}
    try {
      fetch('/api/me', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (m) {
        var fit = document.getElementById('gv-fitness');
        if (fit && m && !m.strava && !document.getElementById('gvStravaNudge')) {
          var n = document.createElement('div'); n.id = 'gvStravaNudge'; n.className = 'gv-nudge';
          n.innerHTML = 'Connect <a href="/api/auth/strava">Strava</a> to unlock Fitness, Fatigue &amp; Form — they read from your activities. Everything else works without it.';
          fit.insertBefore(n, fit.firstChild);
        }
      }).catch(function () {});
    } catch (e) {}
  }

  /* ---------------- weather (Open-Meteo, free, no key) — refreshes hourly ---------------- */
  var WX_TTL = 60 * 60 * 1000; // 1 hour
  function wxCode(c) {
    c = +c;
    if (c === 0) return ['☀️', 'Clear'];
    if (c === 1) return ['🌤️', 'Mainly clear'];
    if (c === 2) return ['⛅', 'Partly cloudy'];
    if (c === 3) return ['☁️', 'Overcast'];
    if (c === 45 || c === 48) return ['🌫️', 'Fog'];
    if (c >= 51 && c <= 57) return ['🌦️', 'Drizzle'];
    if (c >= 61 && c <= 67) return ['🌧️', 'Rain'];
    if (c >= 71 && c <= 77) return ['🌨️', 'Snow'];
    if (c >= 80 && c <= 82) return ['🌦️', 'Rain showers'];
    if (c >= 85 && c <= 86) return ['🌨️', 'Snow showers'];
    if (c >= 95) return ['⛈️', 'Thunderstorm'];
    return ['🌡️', 'Weather'];
  }
  function wxGetCoords(cb) {
    var cached = null; try { cached = JSON.parse(localStorage.getItem('gid_geo') || 'null'); } catch (e) {}
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        function (pos) { var g = { lat: +pos.coords.latitude.toFixed(3), lon: +pos.coords.longitude.toFixed(3) }; try { localStorage.setItem('gid_geo', JSON.stringify(g)); } catch (e) {} cb(g); },
        function () { cb(cached); },
        { timeout: 8000, maximumAge: 30 * 60 * 1000 }
      );
    } else cb(cached);
  }
  function wxRefreshBtn(el) { var r = el.querySelector('#gidWxR'); if (r) r.addEventListener('click', function () { gidEnsureWeather(true); }); }
  function gidRenderWeather(w) {
    var el = document.getElementById('gidWx'); if (!el || !w || !w.current) return;
    var cur = w.current, hs = w.hourly || {};
    var cc = wxCode(cur.weather_code);
    var t = Math.round(cur.temperature_2m), feels = Math.round(cur.apparent_temperature), wind = Math.round(cur.wind_speed_10m);
    var gust = (cur.wind_gusts_10m != null) ? Math.round(cur.wind_gusts_10m) : null;
    var times = hs.time || [], temps = hs.temperature_2m || [], codes = hs.weather_code || [], pp = hs.precipitation_probability || [];
    var now = Date.now(), start = 0;
    for (var i = 0; i < times.length; i++) { if (new Date(times[i]).getTime() >= now) { start = i; break; } }
    var hoursHtml = '';
    for (var j = start; j < Math.min(start + 6, times.length); j++) {
      var hc = wxCode(codes[j]), hr = new Date(times[j]).getHours();
      hoursHtml += '<div class="wx-hr"><div class="h">' + ((hr % 12) || 12) + (hr < 12 ? 'a' : 'p') + '</div><div class="e">' + hc[0] + '</div><div class="t">' + Math.round(temps[j]) + '°</div><div class="p">' + (pp[j] != null && pp[j] > 0 ? pp[j] + '%' : '') + '</div></div>';
    }
    el.innerHTML = '<div class="wx-h"><span>Weather</span><button class="wx-refresh" id="gidWxR" title="Refresh">↻</button></div>'
      + '<div class="wx-now"><div class="wx-ico">' + cc[0] + '</div><div><div class="wx-temp">' + t + '°</div></div>'
      + '<div class="wx-meta"><div class="wx-cond">' + cc[1] + '</div>Feels ' + feels + '° · Wind ' + wind + (gust != null && gust > wind ? '–' + gust : '') + ' km/h' + (cur.relative_humidity_2m != null ? ' · Humidity ' + cur.relative_humidity_2m + '%' : '') + '</div></div>'
      + (hoursHtml ? '<div class="wx-hours">' + hoursHtml + '</div>' : '');
    wxRefreshBtn(el);
  }
  function gidEnsureWeather(force) {
    var el = document.getElementById('gidWx'); if (!el) return;
    var cache = null; try { cache = JSON.parse(localStorage.getItem('gid_weather') || 'null'); } catch (e) {}
    if (!force && cache && cache.data && (Date.now() - cache.ts < WX_TTL)) { gidRenderWeather(cache.data); return; }
    if (!el.innerHTML) el.innerHTML = '<div class="wx-h"><span>Weather</span></div><div class="wx-loading"><span class="gv-dots"><span></span><span></span><span></span></span> checking the sky…</div>';
    wxGetCoords(function (g) {
      if (!g) {
        el.innerHTML = '<div class="wx-h"><span>Weather</span><button class="wx-refresh" id="gidWxR">↻</button></div><div class="wx-err">Allow location to see your forecast, then tap ↻.</div>';
        wxRefreshBtn(el); return;
      }
      // models=best_match → Open-Meteo auto-selects the most accurate model per location
      // (ECMWF where it wins, high-res local models like ICON/AROME where those beat it).
      var u = 'https://api.open-meteo.com/v1/forecast?latitude=' + g.lat + '&longitude=' + g.lon +
        '&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m' +
        '&hourly=temperature_2m,precipitation_probability,weather_code&forecast_days=2&timezone=auto&models=best_match';
      fetch(u).then(function (r) { return r.json(); }).then(function (dw) {
        if (!dw || !dw.current) throw new Error('bad');
        try { localStorage.setItem('gid_weather', JSON.stringify({ ts: Date.now(), data: dw })); } catch (e) {}
        gidRenderWeather(dw);
      }).catch(function () {
        if (cache && cache.data) { gidRenderWeather(cache.data); return; }
        el.innerHTML = '<div class="wx-h"><span>Weather</span><button class="wx-refresh" id="gidWxR">↻</button></div><div class="wx-err">Could not load weather — tap ↻ to retry.</div>';
        wxRefreshBtn(el);
      });
    });
  }
  // hourly auto-refresh + refresh when the app is brought back to the foreground
  setInterval(function () { if (document.getElementById('gidWx')) gidEnsureWeather(true); }, WX_TTL);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) return;
    try { gidEnsureWeather(false); } catch (e) {}
    try { if (document.getElementById('gidPlan')) gidEnsurePlan(false); } catch (e) {}
  });

  /* ---------------- refresh: header button + pull-to-refresh (standalone PWA) ---------------- */
  function gidRefreshApp() { try { location.reload(); } catch (e) {} }
  var GID_STANDALONE = (function () { try { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; } catch (e) { return false; } })();
  // In a home-screen (standalone) app there is no browser pull-to-refresh — add our own.
  (function pullToRefresh() {
    if (!GID_STANDALONE) return;   // in a normal browser the native gesture already works
    var startY = 0, pulling = false, dist = 0, ind = null, THRESH = 85;
    function el() { if (ind) return ind; ind = document.createElement('div'); ind.id = 'gidPTR'; ind.innerHTML = '<span class="gidptr-i">↻</span>'; document.body.appendChild(ind); return ind; }
    function atTop() { return (window.scrollY || document.documentElement.scrollTop || 0) <= 0; }
    document.addEventListener('touchstart', function (e) { if (!atTop()) { pulling = false; return; } startY = e.touches[0].clientY; pulling = true; dist = 0; }, { passive: true });
    document.addEventListener('touchmove', function (e) {
      if (!pulling) return;
      dist = e.touches[0].clientY - startY;
      if (dist > 0 && atTop()) {
        var i = el(); var d = Math.min(dist * 0.5, 60);
        i.style.transform = 'translateX(-50%) translateY(' + (d - 6) + 'px)';
        i.style.opacity = Math.min(dist / THRESH, 1);
        i.classList.toggle('ready', dist > THRESH);
        if (dist > 8 && e.cancelable) e.preventDefault();
      }
    }, { passive: false });
    document.addEventListener('touchend', function () {
      if (!pulling) return; pulling = false;
      if (ind && dist > THRESH) { ind.classList.add('spin'); setTimeout(gidRefreshApp, 150); }
      else if (ind) { ind.style.transform = 'translateX(-50%) translateY(-46px)'; ind.style.opacity = '0'; ind.classList.remove('ready'); }
      dist = 0;
    }, { passive: true });
  })();

  /* ---------------- install helper (Android prompt + iOS Add-to-Home-Screen hint) ---------------- */
  (function installHelper() {
    if (GID_STANDALONE) return;                                   // already installed
    try { if (localStorage.getItem('gid_installHint') === 'dismissed') return; } catch (e) {}
    var ua = navigator.userAgent || '';
    var isIOS = /iphone|ipad|ipod/i.test(ua) && !window.MSStream;
    var deferred = null;
    function dismiss(b) { if (b) b.remove(); try { localStorage.setItem('gid_installHint', 'dismissed'); } catch (e) {} }
    function banner(kind) {
      if (document.getElementById('gidInstall')) return;
      var b = document.createElement('div'); b.id = 'gidInstall';
      var body = kind === 'ios'
        ? 'Add <b>Cyprus</b> to your home screen: tap <b>Share</b> ⬆ then <b>“Add to Home Screen.”</b> It then opens like a real app.'
        : 'Install <b>Cyprus</b> as an app — faster, full-screen, one tap from your home screen.';
      b.innerHTML = '<div class="gi-txt">' + body + '</div><div class="gi-btns">'
        + (kind === 'android' ? '<button class="gi-go" id="giGo">Install</button>' : '')
        + '<button class="gi-x" id="giX">Got it</button></div>';
      document.body.appendChild(b);
      var x = document.getElementById('giX'); if (x) x.addEventListener('click', function () { dismiss(b); });
      var go = document.getElementById('giGo'); if (go) go.addEventListener('click', function () { if (deferred) { deferred.prompt(); deferred = null; } dismiss(b); });
    }
    window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; setTimeout(function () { banner('android'); }, 1500); });
    if (isIOS) setTimeout(function () { banner('ios'); }, 2800);
  })();

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
  setTimeout(build, 1000);
  setTimeout(build, 2600);
})();
