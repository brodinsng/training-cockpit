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
    /* hide FTP (and its stat) for non-cyclists — CSS survives base-app re-renders */
    body.gid-nocycle .metric:has(#pf_ftp){display:none !important;}
    body.gid-nocycle [data-metric="wkg"], body.gid-nocycle .wkg{display:none !important;}
    /* today's fuel */
    .gf-line{font-size:14px;color:var(--ink);padding:2px 0 8px;line-height:1.45;}
    .gf-target{margin-top:6px;font-size:12px;color:var(--peacock);font-weight:700;letter-spacing:.2px;}
    /* readiness score */
    #gidReady{margin-bottom:14px;}
    .gr-h{font-size:12px;letter-spacing:1.4px;text-transform:uppercase;color:var(--peacock);font-weight:800;margin-bottom:12px;}
    .gr-wrap{display:flex;align-items:center;gap:16px;}
    .gr-ring{width:82px;height:82px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;position:relative;background:conic-gradient(var(--c) calc(var(--p)*3.6deg), #1b2532 0);}
    .gr-ring::before{content:'';position:absolute;inset:7px;border-radius:50%;background:var(--card);}
    .gr-num{position:relative;font-size:28px;font-weight:800;color:var(--ink);line-height:1;}
    .gr-body{flex:1;min-width:0;}
    .gr-verdict{font-size:15px;font-weight:700;color:var(--ink);line-height:1.35;margin-bottom:4px;}
    .gr-drivers{font-size:12px;color:var(--mut);}
    .gr-risk{margin-top:10px;font-size:12px;line-height:1.5;padding:9px 11px;border-radius:10px;background:#10171f;border:1px solid var(--line);border-left:3px solid var(--warn) !important;color:var(--ink);}
    .gr-loading{color:var(--mut);font-size:13px;}
    /* race autocomplete dropdown */
    #rcDD{position:fixed;z-index:90;background:var(--card);border:1px solid var(--line);border-radius:12px;max-height:280px;overflow:auto;box-shadow:0 14px 32px rgba(0,0,0,.55);}
    .rc-opt{padding:10px 13px;cursor:pointer;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:10px;}
    .rc-opt:last-child{border-bottom:none;}
    .rc-opt.on,.rc-opt:hover{background:#1a2430;}
    .rc-opt .f{font-size:19px;flex:none;}
    .rc-opt .t{flex:1;min-width:0;}
    .rc-opt .n{font-size:14px;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    .rc-opt .s{font-size:11px;color:var(--mut);}
    .rc-opt .badge{flex:none;font-size:10px;font-weight:800;color:var(--peacock);border:1px solid var(--line);border-radius:6px;padding:2px 7px;}
    /* race conditions card */
    .rc-card{margin-top:14px;background:#10171f;border:1px solid var(--line);border-radius:14px;padding:14px;animation:gvIn .2s ease;}
    .rc-top{display:flex;align-items:center;gap:12px;margin-bottom:12px;}
    .rc-flag{font-size:30px;line-height:1;flex:none;}
    .rc-name{font-size:15px;font-weight:800;color:var(--ink);line-height:1.2;}
    .rc-loc{font-size:12px;color:var(--mut);margin-top:2px;}
    .rc-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
    .rc-tile{background:#0e151d;border:1px solid var(--line);border-radius:10px;padding:9px 11px;}
    .rc-tile .k{font-size:10px;letter-spacing:.7px;text-transform:uppercase;color:var(--mut);}
    .rc-tile .v{font-size:13px;color:var(--ink);margin-top:3px;line-height:1.35;}
    .rc-tips{margin-top:12px;font-size:12px;line-height:1.5;color:var(--ink);padding:9px 11px;border-radius:10px;background:#0e151d;border:1px solid var(--line);border-left:3px solid var(--peacock) !important;}
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
        // recognise real sessions even when named with a brand/shorthand (FIVE45, CCP, WCW, spin, Zwift…)
        var SPORT = /(\brun\b|\bride\b|\bbike\b|cycl|\bspin\b|five45|\bccp\b|\bwcw\b|brick|turbo|zwift|peloton|watt ?bike|\bswim\b|\bgym\b|\blift\b|strength|\brow\b|yoga|pilates|hiit|interval|tempo|threshold|vo2|\bz[2-5]\b|\bftp\b|\btrack\b|\btri\b|session|workout|training|\d+\s?k(m|\b)|\bmile)/i;
        var isSporty = SPORT.test(nm) || orig(e);
        var show = p.showColors || [];
        if (show.length) {
          var c = (e && e.colorId != null) ? String(e.colorId) : '';
          if (show.indexOf(c) === -1) return false;   // not one of the user's training colours → not theirs
          return isSporty;                             // their colour AND looks like a session
        }
        return isSporty;                               // no colour filter → detect by name
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
            // Readiness score at the VERY top of Today — the "should I train hard?" answer
            if (todayView && !document.getElementById('gidReady')) {
              var rc = document.createElement('div'); rc.className = 'card'; rc.id = 'gidReady';
              todayView.insertBefore(rc, todayView.firstChild);
              gidReadiness(); gidReadinessWatch();
            }
            // weekly plan → Google Calendar card at the top of the Schedule view
            var schedView = document.getElementById('gv-schedule');
            if (schedView && !document.getElementById('gidWeek')) {
              var gwc = document.createElement('div'); gwc.className = 'card'; gwc.id = 'gidWeek';
              schedView.insertBefore(gwc, schedView.firstChild);
              gwRender();
            }
            gidPolish();
            rcInit();
            // structured meal prep + working AI generation
            window.renderMeals = gidRenderMeals;
            window.generateMeals = gidGenerateMeals;
            gidRenderMeals();
            // Today's Fuel — daily, workout-aware — at the top of the Fuel view
            var fuelView = document.getElementById('gv-fuel');
            if (fuelView && !document.getElementById('gidFuel')) {
              var fcard = document.createElement('div'); fcard.className = 'card'; fcard.id = 'gidFuel';
              fuelView.insertBefore(fcard, fuelView.firstChild);
              fuelEnsure(false);
            }
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
      readiness: (function () { try { var r = JSON.parse(localStorage.getItem('gid_readiness') || 'null'); return r ? { score: r.score, band: r.band, acute_chronic_ratio: r.acwr != null ? +r.acwr.toFixed(2) : null } : null; } catch (e) { return null; } })(),
      weeks_to_race: (function () { var m = (document.body.textContent || '').match(/([\d.]+)\s*weeks to go/); return m ? parseFloat(m[1]) : null; })(),
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
      ". CRITICAL RULES: (1) Read 'completed_today' — if the athlete has ALREADY trained today, do NOT prescribe more of what they've done; if they've already done substantial work (a ride AND a run, or a long/hard session), the answer is REST or gentle recovery only — never add load on top of an overloaded day. " +
      "(2) Respect 'readiness' — band 'red' or score <50 → easy recovery or REST only; 'amber' → easy aerobic only, no intensity; 'green' → a quality/hard session is OK. Also honour 'daily_checkin' (poor sleep/soreness → easier). " +
      "(3) POLARISED (80/20): most training is easy aerobic; reserve hard efforts for green-readiness days and NEVER put intensity on back-to-back days — avoid the moderate 'grey zone'. " +
      "(4) If 'readiness.acute_chronic_ratio' > 1.3, the athlete is ramping too fast (injury risk) — bias toward easy/recovery. (5) If 'weeks_to_race' is 2 or less, TAPER: cut volume, keep a short sharp bit of intensity. (6) Tailor to the sports in 'profile' — never prescribe a sport they don't do. " +
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
      // non-cyclist → hide FTP. Body class + CSS :has() survives the base app's metric re-renders.
      var noCycle = p.done && (p.sports || []).length > 0 && !isCyclist();
      document.body.classList.toggle('gid-nocycle', noCycle);
      if (f) { var box = f.closest('.metric'); if (box) box.style.display = noCycle ? 'none' : ''; }
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
      + "(3) POLARISE the week (80/20): ~80% of sessions are EASY aerobic, only 1-2 genuinely HARD/quality sessions, and keep hard days apart (never back-to-back). Avoid a week full of moderate 'grey zone' efforts. Put focus words like 'easy Z2', 'endurance', 'recovery', 'threshold', 'intervals', 'long' so intensity is clear. "
      + "(4) Factor current fatigue/form/readiness — if fatigue is high, form negative, or 'readiness' is amber/red, cut the hard sessions and add easy/recovery. If the acute:chronic load ratio is high (>1.3), keep the week easy (a deload). "
      + "(5) TAPER: if 'weeks_to_race' is 2 or less, sharply reduce volume but keep one short session with race-pace intensity. Otherwise progress gently toward the race. "
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

  /* ---------------- Race intelligence: autocomplete famous races + live conditions ----------------
     Static facts (location, course profile, swim venue) are curated; air temperature is pulled LIVE
     from Open-Meteo historical data for the race's location + date. Starter set — the weekly loop grows it. */
  var DIST = { marathon: '42.2 km', half: '21.1 km', ironman: '3.8k swim · 180k bike · 42.2k run', '70.3': '1.9k swim · 90k bike · 21.1k run', olympic: '1.5k swim · 40k bike · 10k run' };
  var TYPEBADGE = { marathon: 'MAR', half: 'HALF', ironman: 'IM', '70.3': '70.3', olympic: 'OLY', ultra: 'ULTRA', trail: 'TRAIL', cycling: 'RIDE', granfondo: 'FONDO', swim: 'SWIM', run: 'RUN', xtri: 'XTRI' };
  var RACES = [
    { n: 'Tokyo Marathon', city: 'Tokyo', country: 'Japan', cc: 'JP', lat: 35.68, lon: 139.76, m: 3, d: 1, t: 'marathon', p: 'flat', pn: 'Flat & fast city loop' },
    { n: 'Boston Marathon', city: 'Boston', country: 'USA', cc: 'US', lat: 42.36, lon: -71.06, m: 4, d: 20, t: 'marathon', p: 'hilly', pn: 'Rolling, Heartbreak Hill; net downhill' },
    { n: 'London Marathon', city: 'London', country: 'UK', cc: 'GB', lat: 51.51, lon: -0.13, m: 4, d: 26, t: 'marathon', p: 'flat', pn: 'Flat, fast, a few bridges' },
    { n: 'Paris Marathon', city: 'Paris', country: 'France', cc: 'FR', lat: 48.85, lon: 2.35, m: 4, d: 13, t: 'marathon', p: 'rolling', pn: 'Gently rolling, cobbles in places' },
    { n: 'Gold Coast Marathon', city: 'Gold Coast', country: 'Australia', cc: 'AU', lat: -28.0, lon: 153.43, m: 7, d: 6, t: 'marathon', p: 'flat', pn: 'Pancake flat, coastal' },
    { n: 'Sydney Marathon', city: 'Sydney', country: 'Australia', cc: 'AU', lat: -33.87, lon: 151.21, m: 8, d: 30, t: 'marathon', p: 'hilly', pn: 'Hilliest Major; Harbour Bridge' },
    { n: 'Berlin Marathon', city: 'Berlin', country: 'Germany', cc: 'DE', lat: 52.52, lon: 13.4, m: 9, d: 27, t: 'marathon', p: 'flat', pn: 'Pancake flat — record course' },
    { n: 'Chicago Marathon', city: 'Chicago', country: 'USA', cc: 'US', lat: 41.88, lon: -87.63, m: 10, d: 11, t: 'marathon', p: 'flat', pn: 'Flat & fast, big crowds' },
    { n: 'Amsterdam Marathon', city: 'Amsterdam', country: 'Netherlands', cc: 'NL', lat: 52.37, lon: 4.9, m: 10, d: 19, t: 'marathon', p: 'flat', pn: 'Flat, stadium finish' },
    { n: 'New York City Marathon', city: 'New York', country: 'USA', cc: 'US', lat: 40.71, lon: -74.01, m: 11, d: 1, t: 'marathon', p: 'rolling', pn: 'Rolling, five boroughs & bridges' },
    { n: 'Valencia Marathon', city: 'Valencia', country: 'Spain', cc: 'ES', lat: 39.47, lon: -0.38, m: 12, d: 7, t: 'marathon', p: 'flat', pn: 'Sea-level — among the flattest' },
    { n: 'Standard Chartered Singapore Marathon', city: 'Singapore', country: 'Singapore', cc: 'SG', lat: 1.29, lon: 103.85, m: 12, d: 7, t: 'marathon', p: 'flat', pn: 'Flat; hot & humid' },
    { n: 'Great North Run', city: 'Newcastle', country: 'UK', cc: 'GB', lat: 54.97, lon: -1.61, m: 9, d: 7, t: 'half', p: 'rolling', pn: "World's biggest half; rolling to coast" },
    { n: 'IRONMAN World Championship (Kona)', city: 'Kailua-Kona', country: 'USA', cc: 'US', lat: 19.64, lon: -155.99, m: 10, d: 10, t: 'ironman', p: 'rolling', pn: 'Lava fields, heat & crosswinds', w: { temp: 26, note: 'warm ocean, usually non-wetsuit' } },
    { n: 'IRONMAN Cairns', city: 'Cairns', country: 'Australia', cc: 'AU', lat: -16.92, lon: 145.77, m: 6, d: 14, t: 'ironman', p: 'rolling', pn: 'Ocean swim, scenic rolling bike', w: { temp: 25, note: 'warm ocean, often non-wetsuit' } },
    { n: 'IRONMAN Frankfurt (European Champ)', city: 'Frankfurt', country: 'Germany', cc: 'DE', lat: 50.11, lon: 8.68, m: 6, d: 28, t: 'ironman', p: 'rolling', pn: 'Lake swim, rolling bike', w: { temp: 22, note: 'lake, wetsuit often legal' } },
    { n: 'Challenge Roth', city: 'Roth', country: 'Germany', cc: 'DE', lat: 49.25, lon: 11.09, m: 7, d: 6, t: 'ironman', p: 'rolling', pn: 'Iconic; fast rolling bike', w: { temp: 21, note: 'canal, wetsuit-legal' } },
    { n: 'IRONMAN Nice', city: 'Nice', country: 'France', cc: 'FR', lat: 43.7, lon: 7.27, m: 6, d: 28, t: 'ironman', p: 'hilly', pn: 'Big Alpine-style climbs', w: { temp: 22, note: 'Mediterranean sea swim' } },
    { n: 'IRONMAN Lanzarote', city: 'Puerto del Carmen', country: 'Spain', cc: 'ES', lat: 28.92, lon: -13.66, m: 5, d: 17, t: 'ironman', p: 'hilly', pn: 'Relentless hills & wind', w: { temp: 20, note: 'Atlantic; wetsuit-legal' } },
    { n: 'IRONMAN Western Australia (Busselton)', city: 'Busselton', country: 'Australia', cc: 'AU', lat: -33.65, lon: 115.35, m: 12, d: 7, t: 'ironman', p: 'flat', pn: 'Flat & fast; jetty swim', w: { temp: 21, note: 'wetsuit-legal' } },
    { n: 'IRONMAN 70.3 World Championship (Nice)', city: 'Nice', country: 'France', cc: 'FR', lat: 43.7, lon: 7.27, m: 9, d: 13, t: '70.3', p: 'hilly', pn: 'Climbing bike course', w: { temp: 23, note: 'Mediterranean sea swim' } },
    { n: 'IRONMAN 70.3 Geelong', city: 'Geelong', country: 'Australia', cc: 'AU', lat: -38.15, lon: 144.36, m: 3, d: 22, t: '70.3', p: 'flat', pn: 'Flat, fast bay-front course', w: { temp: 15, note: 'cool bay — wetsuit-legal' } },
    { n: 'IRONMAN 70.3 Melbourne', city: 'Melbourne', country: 'Australia', cc: 'AU', lat: -37.81, lon: 144.96, m: 11, d: 17, t: '70.3', p: 'flat', pn: 'Flat coastal course', w: { temp: 18, note: 'bay swim; often wetsuit-legal' } },
    { n: 'IRONMAN 70.3 Bintan', city: 'Bintan', country: 'Indonesia', cc: 'ID', lat: 1.07, lon: 104.42, m: 8, d: 24, t: '70.3', p: 'rolling', pn: 'Warm island; rolling bike', w: { temp: 29, note: 'warm sea — non-wetsuit' } },
    { n: 'IRONMAN 70.3 Desaru Coast', city: 'Desaru', country: 'Malaysia', cc: 'MY', lat: 1.55, lon: 104.27, m: 9, d: 21, t: '70.3', p: 'rolling', pn: 'Warm, humid; rolling bike', w: { temp: 29, note: 'warm sea — non-wetsuit' } },
    { n: 'Marine Corps Marathon', city: 'Arlington', country: 'USA', cc: 'US', lat: 38.88, lon: -77.05, m: 10, d: 25, t: 'marathon', p: 'rolling', pn: 'Rolling; monuments & bridges' },
    { n: 'Big Sur International Marathon', city: 'Big Sur', country: 'USA', cc: 'US', lat: 36.27, lon: -121.81, m: 4, d: 26, t: 'marathon', p: 'hilly', pn: 'Coastal cliffs; Hurricane Point climb' },
    { n: 'Honolulu Marathon', city: 'Honolulu', country: 'USA', cc: 'US', lat: 21.31, lon: -157.86, m: 12, d: 13, t: 'marathon', p: 'flat', pn: 'Flat; hot & humid, pre-dawn start' },
    { n: 'Athens Authentic Marathon', city: 'Athens', country: 'Greece', cc: 'GR', lat: 37.98, lon: 23.73, m: 11, d: 8, t: 'marathon', p: 'hilly', pn: 'Long uphill 10-31 km; the original course' },
    { n: 'City2Surf', city: 'Sydney', country: 'Australia', cc: 'AU', lat: -33.87, lon: 151.21, m: 8, d: 9, t: 'run', p: 'hilly', pn: '14 km; Heartbreak Hill to Bondi', dl: '14 km' },
    { n: 'UTMB (Ultra-Trail du Mont-Blanc)', city: 'Chamonix', country: 'France', cc: 'FR', lat: 45.92, lon: 6.87, m: 8, d: 28, t: 'trail', p: 'hilly', pn: '171 km loop around Mont Blanc', dl: '171 km \u00b7 10,000 m+' },
    { n: 'Western States 100', city: 'Olympic Valley', country: 'USA', cc: 'US', lat: 39.2, lon: -120.24, m: 6, d: 27, t: 'trail', p: 'hilly', pn: 'Sierra trail; canyons & heat', dl: '161 km (100 mi)' },
    { n: 'Comrades Marathon', city: 'Durban', country: 'South Africa', cc: 'ZA', lat: -29.86, lon: 31.02, m: 6, d: 14, t: 'ultra', p: 'hilly', pn: 'Road ultra; the Big Five hills', dl: '~87 km' },
    { n: 'Two Oceans Marathon', city: 'Cape Town', country: 'South Africa', cc: 'ZA', lat: -34.05, lon: 18.46, m: 4, d: 11, t: 'ultra', p: 'hilly', pn: 'Chapman\u2019s Peak & Constantia Nek', dl: '56 km' },
    { n: 'Marathon des Sables', city: 'Sahara', country: 'Morocco', cc: 'MA', lat: 30.93, lon: -5.0, m: 4, d: 5, t: 'ultra', p: 'hilly', pn: 'Self-supported desert stage race', dl: '~250 km \u00b7 6 stages' },
    { n: 'Leadville Trail 100 Run', city: 'Leadville', country: 'USA', cc: 'US', lat: 39.25, lon: -106.29, m: 8, d: 22, t: 'trail', p: 'hilly', pn: 'At altitude (3,000-3,850 m)', dl: '161 km (100 mi)' },
    { n: 'Ultra-Trail Australia', city: 'Blue Mountains', country: 'Australia', cc: 'AU', lat: -33.73, lon: 150.31, m: 5, d: 16, t: 'trail', p: 'hilly', pn: 'Stairs, escarpments & bush', dl: '100 km' },
    { n: 'Cape Town Cycle Tour', city: 'Cape Town', country: 'South Africa', cc: 'ZA', lat: -33.92, lon: 18.42, m: 3, d: 8, t: 'cycling', p: 'rolling', pn: 'Peninsula loop; often windy', dl: '109 km' },
    { n: 'L\u2019\u00c9tape du Tour', city: 'French Alps', country: 'France', cc: 'FR', lat: 45.17, lon: 6.6, m: 7, d: 19, t: 'granfondo', p: 'hilly', pn: 'A Tour de France mountain stage', dl: '~170 km \u00b7 big cols' },
    { n: 'Maratona dles Dolomites', city: 'Corvara', country: 'Italy', cc: 'IT', lat: 46.55, lon: 11.87, m: 7, d: 5, t: 'granfondo', p: 'hilly', pn: 'Seven Dolomite passes', dl: '138 km \u00b7 4,230 m+' },
    { n: 'GFNY (Gran Fondo New York)', city: 'New York', country: 'USA', cc: 'US', lat: 40.85, lon: -73.97, m: 5, d: 17, t: 'granfondo', p: 'hilly', pn: 'Up the Hudson; timed climbs', dl: '160 km' },
    { n: 'Peaks Challenge Falls Creek', city: 'Falls Creek', country: 'Australia', cc: 'AU', lat: -36.87, lon: 147.28, m: 3, d: 8, t: 'granfondo', p: 'hilly', pn: 'Alpine loop; 4,000 m of climbing', dl: '235 km \u00b7 4,000 m+' },
    { n: 'Rottnest Channel Swim', city: 'Cottesloe', country: 'Australia', cc: 'AU', lat: -31.99, lon: 115.75, m: 2, d: 21, t: 'swim', p: 'flat', pn: 'Open-water crossing to Rottnest', dl: '19.7 km open water', w: { temp: 22, note: 'ocean; solo or team' } },
    { n: 'Midmar Mile', city: 'Midmar Dam', country: 'South Africa', cc: 'ZA', lat: -29.51, lon: 30.19, m: 2, d: 7, t: 'swim', p: 'flat', pn: 'World\u2019s largest open-water swim', dl: '1.6 km (1 mi)', w: { temp: 23, note: 'freshwater dam' } },
    { n: 'Norseman Xtreme Triathlon', city: 'Eidfjord', country: 'Norway', cc: 'NO', lat: 60.47, lon: 7.07, m: 8, d: 1, t: 'xtri', p: 'hilly', pn: 'Iron-distance; 5,000 m climb, mountain finish', dl: '3.8k swim \u00b7 180k bike \u00b7 42.2k run', w: { temp: 14, note: 'cold fjord \u2014 wetsuit, ferry jump start' } },
    { n: 'Escape from Alcatraz Triathlon', city: 'San Francisco', country: 'USA', cc: 'US', lat: 37.81, lon: -122.42, m: 6, d: 7, t: 'xtri', p: 'hilly', pn: 'Alcatraz swim, hilly bike, sand-ladder run', dl: '2.4k swim \u00b7 29k bike \u00b7 13k run', w: { temp: 14, note: 'cold bay \u2014 wetsuit essential' } },
    { n: 'IRONMAN Barcelona', city: 'Calella', country: 'Spain', cc: 'ES', lat: 41.61, lon: 2.65, m: 10, d: 4, t: 'ironman', p: 'flat', pn: 'Flat, fast coastal bike', w: { temp: 20, note: 'Mediterranean sea swim' } },
  ];
  function rcFlag(cc) { try { return cc.toUpperCase().replace(/./g, function (c) { return String.fromCodePoint(127397 + c.charCodeAt()); }); } catch (e) { return '🏁'; } }
  var RCMON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function rcNextDate(r) { var now = new Date(); now.setHours(0, 0, 0, 0); var y = now.getFullYear(); var dt = new Date(y, r.m - 1, r.d); if (dt < now) dt = new Date(y + 1, r.m - 1, r.d); return dt; }
  function rcYmd(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function rcTemp(r, cb) {
    function pad(n) { return ('0' + n).slice(-2); }
    var yr = new Date().getFullYear() - 1;
    var base = new Date(yr, r.m - 1, r.d), s = new Date(base.getTime() - 3 * 864e5), e = new Date(base.getTime() + 3 * 864e5);
    var url = 'https://archive-api.open-meteo.com/v1/archive?latitude=' + r.lat + '&longitude=' + r.lon
      + '&start_date=' + s.getFullYear() + '-' + pad(s.getMonth() + 1) + '-' + pad(s.getDate())
      + '&end_date=' + e.getFullYear() + '-' + pad(e.getMonth() + 1) + '-' + pad(e.getDate())
      + '&daily=temperature_2m_max,temperature_2m_min&timezone=auto';
    fetch(url).then(function (x) { return x.json(); }).then(function (d) {
      var mx = (d.daily && d.daily.temperature_2m_max) || [], mn = (d.daily && d.daily.temperature_2m_min) || [];
      mx = mx.filter(function (v) { return v != null; }); mn = mn.filter(function (v) { return v != null; });
      if (!mx.length || !mn.length) { cb(null); return; }
      cb({ lo: Math.round(mn.reduce(function (a, b) { return a + b; }, 0) / mn.length), hi: Math.round(mx.reduce(function (a, b) { return a + b; }, 0) / mx.length) });
    }).catch(function () { cb(null); });
  }
  function rcTips(r, temp) {
    var t = [];
    if (r.t === 'ultra' || r.t === 'trail') t.push('long \u2014 build time-on-feet & fuelling');
    if (r.p === 'hilly') t.push('hilly — build hill strength & climbing');
    else if (r.p === 'rolling') t.push('rolling — include some hill work');
    else t.push('flat & fast — sharpen race-pace & run economy');
    if (temp && temp.hi >= 28) t.push('hot — heat-acclimate & rehearse hydration');
    else if (temp && temp.hi <= 10) t.push('cold — plan warm-up & layers');
    if (r.w) { if (r.w.temp <= 16) t.push('cold swim — practise in a wetsuit'); else if (r.w.temp >= 27) t.push('warm swim — likely non-wetsuit'); }
    return t.join(' · ');
  }
  function rcRenderCard(r) {
    var host = document.getElementById('rcCard');
    if (!host) { var af = document.querySelector('.addform'); if (!af) return; host = document.createElement('div'); host.id = 'rcCard'; af.parentNode.insertBefore(host, af.nextSibling); }
    function tile(k, v) { return '<div class="rc-tile"><div class="k">' + k + '</div><div class="v">' + esc(v) + '</div></div>'; }
    function draw(tempStr) {
      host.innerHTML = '<div class="rc-card"><div class="rc-top"><span class="rc-flag">' + rcFlag(r.cc) + '</span><div><div class="rc-name">' + esc(r.n) + '</div><div class="rc-loc">' + esc(r.city + ', ' + r.country) + ' · typically ' + RCMON[r.m - 1] + '</div></div></div>'
        + '<div class="rc-grid">' + tile('Distance', r.dl || DIST[r.t] || '—') + tile('Course', (r.p.charAt(0).toUpperCase() + r.p.slice(1)) + (r.pn ? ' — ' + r.pn : '')) + tile('Typical air temp', tempStr) + (r.w ? tile('Water', r.w.temp + '°C · ' + r.w.note) : '') + '</div>'
        + '<div class="rc-tips">🎯 Train for it: ' + esc(rcTips(r, host.__temp)) + '</div>'
        + '<div class="rc-loc" style="margin-top:10px">Date set below — tap <b>Add race</b> to start your countdown.</div>';
    }
    draw('checking…');
    rcTemp(r, function (temp) { host.__temp = temp; draw(temp ? temp.lo + '–' + temp.hi + '°C' : 'unavailable'); });
  }
  function rcInit() {
    var rn = document.getElementById('rn'); if (!rn || rn.__rcInit) return; rn.__rcInit = true;
    var dd = null, matches = [];
    function close() { if (dd) { dd.remove(); dd = null; } }
    function place() { if (!dd) return; var r = rn.getBoundingClientRect(); dd.style.left = r.left + 'px'; dd.style.top = (r.bottom + 4) + 'px'; dd.style.width = r.width + 'px'; }
    function open() {
      var q = (rn.value || '').trim().toLowerCase();
      if (q.length < 2) { close(); return; }
      matches = RACES.filter(function (r) { return (r.n + ' ' + r.city + ' ' + r.country + ' ' + r.t).toLowerCase().indexOf(q) > -1; }).slice(0, 8);
      if (!matches.length) { close(); return; }
      if (!dd) { dd = document.createElement('div'); dd.id = 'rcDD'; document.body.appendChild(dd); }
      dd.innerHTML = matches.map(function (r, i) { return '<div class="rc-opt" data-i="' + i + '"><span class="f">' + rcFlag(r.cc) + '</span><div class="t"><div class="n">' + esc(r.n) + '</div><div class="s">' + esc(r.city + ', ' + r.country) + '</div></div><span class="badge">' + (TYPEBADGE[r.t] || '') + '</span></div>'; }).join('');
      place();
      dd.querySelectorAll('.rc-opt').forEach(function (o) { o.addEventListener('mousedown', function (ev) { ev.preventDefault(); pick(matches[+o.getAttribute('data-i')]); }); });
    }
    function pick(r) {
      rn.value = r.n;
      var rd = document.getElementById('rd'); if (rd) { rd.value = rcYmd(rcNextDate(r)); try { rd.dispatchEvent(new Event('input', { bubbles: true })); rd.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {} }
      close(); rcRenderCard(r);
    }
    rn.addEventListener('input', open);
    rn.addEventListener('focus', open);
    rn.addEventListener('blur', function () { setTimeout(close, 150); });
    window.addEventListener('resize', place); window.addEventListener('scroll', place, true);
  }

  /* ---------------- Readiness Score (0–100) — form + acute:chronic load + how you feel ----------------
     Grounded in: training-load monitoring (TSB/form), the acute:chronic workload ratio (ATL/CTL — a
     high ratio + low subjective recovery raises overuse-injury risk), and daily subjective readiness.
     It replaces scattered signals with one number and feeds the plan. */
  function gidReadNums() {
    var bigs = Array.prototype.slice.call(document.querySelectorAll('.gauge .big')).map(function (e) { return parseFloat((e.textContent || '').replace(/[^\-\d.]/g, '')); });
    var ctl = bigs[0], atl = bigs[1], tsb = bigs[2];
    var haveObj = isFinite(ctl) && isFinite(atl) && ctl > 0;
    var acwr = haveObj ? (atl / ctl) : null;
    if (!isFinite(tsb) && haveObj) tsb = ctl - atl;
    var subj = null; var rd = document.getElementById('readi');
    if (rd) { var m = (rd.textContent || '').match(/([0-5](?:\.\d)?)\s*\/\s*5/); if (m) subj = parseFloat(m[1]); }
    return { ctl: ctl, atl: atl, tsb: isFinite(tsb) ? tsb : null, acwr: acwr, subj: subj, haveObj: haveObj };
  }
  function gidReadiness() {
    var el = document.getElementById('gidReady'); if (!el) return;
    var n = gidReadNums();
    if (!n.haveObj && n.subj == null) { el.innerHTML = '<div class="gr-h">Readiness</div><div class="gr-loading">Connect Strava and log a quick check-in to get your daily readiness.</div>'; return; }
    var fTsb = (n.tsb != null) ? Math.max(0, Math.min(1, (n.tsb + 20) / 40)) : 0.5;
    var fAcwr = (n.acwr == null) ? 0.7 : (n.acwr <= 1.3 ? 1 : Math.max(0, 1 - (n.acwr - 1.3) / 0.5));
    var fSubj = (n.subj == null) ? null : (n.subj / 5);
    var score = (fSubj == null) ? Math.round(100 * (0.6 * fTsb + 0.4 * fAcwr)) : Math.round(100 * (0.35 * fTsb + 0.25 * fAcwr + 0.40 * fSubj));
    score = Math.max(1, Math.min(100, score));
    var band = score >= 75 ? 'green' : (score >= 50 ? 'amber' : 'red');
    var col = band === 'green' ? 'var(--good)' : (band === 'amber' ? 'var(--warn)' : 'var(--bad)');
    var verdict = band === 'green' ? 'Primed — green light for a key or hard session.' : (band === 'amber' ? 'Moderate — train, but keep most of it easy/aerobic.' : 'Back off — easy or rest; recovery will pay you back.');
    var drivers = [];
    if (n.tsb != null) drivers.push('Form ' + (n.tsb >= 0 ? '+' : '') + Math.round(n.tsb));
    if (n.acwr != null) drivers.push('load ratio ' + n.acwr.toFixed(2));
    drivers.push(n.subj != null ? 'you feel ' + n.subj + '/5' : 'log check-in to refine');
    var risk = (n.acwr != null && n.acwr > 1.3) ? '<div class="gr-risk">⚠ Your load is ramping fast (acute:chronic ' + n.acwr.toFixed(2) + '). That plus low recovery is when overuse injuries spike — avoid stacking hard days this week.</div>' : '';
    try { localStorage.setItem('gid_readiness', JSON.stringify({ score: score, band: band, acwr: n.acwr, tsb: n.tsb, ts: Date.now() })); } catch (e) {}
    el.innerHTML = '<div class="gr-h">Readiness · today</div>'
      + '<div class="gr-wrap"><div class="gr-ring" style="--p:' + score + ';--c:' + col + '"><div class="gr-num">' + score + '</div></div>'
      + '<div class="gr-body"><div class="gr-verdict">' + verdict + '</div><div class="gr-drivers">' + drivers.join(' · ') + '</div></div></div>' + risk;
  }
  function gidReadinessWatch() {
    var rd = document.getElementById('readi');
    if (rd && !rd.__gidWatch && window.MutationObserver) {
      rd.__gidWatch = true;
      new MutationObserver(function () { gidReadiness(); }).observe(rd, { childList: true, subtree: true, characterData: true });
    }
    [600, 1600, 3200].forEach(function (t) { setTimeout(gidReadiness, t); });
  }

  /* ---------------- Today's Fuel — daily, workout-aware nutrition ---------------- */
  function fuelDayKey() { var d = new Date(Date.now() - 3 * 3600 * 1000); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function fuelDoneSnip() { var d = document.getElementById('todayDone'); return d ? (d.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120) : ''; }
  function fuelContext() {
    function grab(sel, n) { return Array.prototype.slice.call(document.querySelectorAll(sel)).map(function (e) { return (e.textContent || '').trim().replace(/\s+/g, ' '); }).slice(0, n); }
    var g = grab('.gauge .big', 3), caps = grab('.gauge .cap', 3);
    var plan = ''; try { var pl = JSON.parse(localStorage.getItem('gid_plan') || 'null'); plan = pl && pl.sessions ? pl.sessions.join('; ') : ''; } catch (e) {}
    return {
      profile: getProfile(),
      completed_today: fuelDoneSnip() || 'nothing logged yet today',
      today_plan: plan,
      fitness_fatigue_form: g.map(function (v, i) { return (caps[i] || '') + ': ' + v; }),
      weekday: new Date().toLocaleDateString('en-GB', { weekday: 'long' })
    };
  }
  function fuelGet() { try { return JSON.parse(localStorage.getItem('gid_fuel') || 'null'); } catch (e) { return null; } }
  function fuelSet(f) { try { localStorage.setItem('gid_fuel', JSON.stringify(f)); } catch (e) {} }
  function fuelRender(f) {
    var el = document.getElementById('gidFuel'); if (!el) return;
    el.innerHTML = '<div class="gw-h"><span>Today\'s Fuel · adapts to your training</span><button class="wx-refresh" id="gidFuelR" title="Re-tune to today">↻</button></div>'
      + (f.note ? '<div class="gw-note" style="margin-bottom:12px">' + esc(f.note) + '</div>' : '')
      + '<div class="gvmeal"><label>🌅 Breakfast</label><div class="gf-line">' + esc(f.b || '—') + '</div>'
      + '<label>☀️ Lunch</label><div class="gf-line">' + esc(f.l || '—') + '</div>'
      + '<label>🌙 Dinner</label><div class="gf-line">' + esc(f.d || '—') + '</div>'
      + (f.kcal ? '<div class="gf-target">≈ ' + esc(f.kcal) + (f.carbs ? ' · ' + esc(f.carbs) : '') + '</div>' : '') + '</div>';
    var r = document.getElementById('gidFuelR'); if (r) r.addEventListener('click', function () { fuelEnsure(true); });
  }
  function fuelEnsure(force) {
    var el = document.getElementById('gidFuel'); if (!el) return;
    var key = fuelDayKey(), snip = fuelDoneSnip(), f = fuelGet();
    // re-use cached fuel only if it's for today AND the day's logged training hasn't changed since
    if (!force && f && f.date === key && f.b && f.doneSnip === snip) { fuelRender(f); return; }
    el.innerHTML = '<div class="gw-h"><span>Today\'s Fuel · adapts to your training</span></div><div class="gw-loading"><span class="gv-dots"><span></span><span></span><span></span></span> tuning today\'s nutrition to your training…</div>';
    var p = getProfile();
    var bmi = (p.heightCm && p.weightKg) ? (p.weightKg / Math.pow(p.heightCm / 100, 2)).toFixed(1) : '?';
    var prompt = "Design TODAY's nutrition for this endurance athlete using the 'fuel for the work required' principle — match carbohydrate to the day's actual demand, don't over-carb an easy or rest day. "
      + "Read 'completed_today' and 'today_plan' in the context: a hard/long session (long ride/run, high load) → higher calories, CARB-loaded around the session; if a hard/key session is still to come today, carb-load beforehand; an easy/short day → moderate carbs; a REST day → lower carbs, protein-forward (~1.8-2g/kg), slightly fewer calories to aid recovery. "
      + "Respect dietary restrictions strictly: '" + (p.diet || 'none') + "'. "
      + "Athlete: sports " + ((p.sports || []).join(', ') || 'general') + ", " + (p.sex || '?') + ", " + (p.age || '?') + "y, " + (p.heightCm || '?') + "cm, " + (p.weightKg || '?') + "kg, BMI " + bmi + ", goal " + (p.goal || '?') + ". "
      + "Output EXACTLY 5 lines and nothing else:\nNOTE: <one short sentence on why today's fuel looks like this, referencing today's training>\nB: <breakfast>\nL: <lunch>\nD: <dinner>\nTARGET: <approx daily kcal> | <carb emphasis, e.g. high-carb ~6-8g/kg>";
    fetch('/api/u/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: prompt, context: fuelContext(), history: [] }) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var t = d.reply || '';
        function pick(re) { var m = t.match(re); return m ? m[1].trim() : ''; }
        var f2 = { date: key, doneSnip: snip, note: pick(/NOTE:\s*(.+)/i), b: pick(/(?:^|\n)\s*B:\s*(.+)/i), l: pick(/(?:^|\n)\s*L:\s*(.+)/i), d: pick(/(?:^|\n)\s*D:\s*(.+)/i), kcal: '', carbs: '' };
        var tg = t.match(/TARGET:\s*(.+)/i);
        if (tg) { var parts = tg[1].split('|'); f2.kcal = (parts[0] || '').trim(); f2.carbs = (parts[1] || '').trim(); }
        if (!f2.b && !f2.l && !f2.d) { f2.note = f2.note || t.slice(0, 160); }
        fuelSet(f2); fuelRender(f2);
      })
      .catch(function () {
        el.innerHTML = '<div class="gw-h"><span>Today\'s Fuel</span><button class="wx-refresh" id="gidFuelR">↻</button></div><div class="gw-note warn">Could not build today\'s fuel — tap ↻ to retry.</div>';
        var r = document.getElementById('gidFuelR'); if (r) r.addEventListener('click', function () { fuelEnsure(true); });
      });
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
    try { if (document.getElementById('gidReady')) gidReadiness(); } catch (e) {}
    try { if (document.getElementById('gidPlan')) gidEnsurePlan(false); } catch (e) {}
    try { if (document.getElementById('gidFuel')) fuelEnsure(false); } catch (e) {}
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

;(function(){
  function E(s){s=(s==null?'':''+s);return s.replace(/[&<>"]/g,function(c){return c==='&'?'&amp;':c==='<'?'&lt;':c==='>'?'&gt;':'&quot;';});}
  function num(el){return el?parseFloat((el.textContent||'').replace(/[^0-9.-]/g,'')):NaN;}
  function chart(id){try{return (window.Chart&&Chart.getChart)?Chart.getChart(document.getElementById(id)):null;}catch(e){return null;}}
  function tone(t){return t==='good'?'var(--good)':t==='warn'?'var(--warn)':t==='bad'?'var(--bad)':'var(--mut)';}
  function nnum(s){var d=(''+s).replace(/[^0-9.]/g,'');return d?parseFloat(d):null;}
  function fresh(tsb){if(tsb>=15)return{w:'Very fresh',t:'good',m:'Very light load — well recovered'};if(tsb>=5)return{w:'Fresh',t:'good',m:'Light training load'};if(tsb>=-5)return{w:'Neutral',t:'mut',m:'Balanced load'};if(tsb>=-15)return{w:'Fatigued',t:'warn',m:'Carrying training fatigue'};return{w:'Very fatigued',t:'bad',m:'Heavy fatigue — prioritise recovery'};}
  function band(name){var s=(name||'').toLowerCase();if(s.indexOf('70.3')>-1||s.indexOf('olympic')>-1)return{lo:75,hi:95,mid:85,lbl:'70.3 / Olympic'};if(s.indexOf('ironman')>-1||s.indexOf('xtri')>-1||s.indexOf('norseman')>-1)return{lo:95,hi:125,mid:110,lbl:'Iron-distance'};if(s.indexOf('ultra')>-1||s.indexOf('utmb')>-1||s.indexOf('comrades')>-1||s.indexOf('trail')>-1)return{lo:90,hi:120,mid:105,lbl:'Ultra / trail'};if(s.indexOf('half mara')>-1)return{lo:55,hi:75,mid:65,lbl:'Half marathon'};if(s.indexOf('mara')>-1)return{lo:70,hi:90,mid:80,lbl:'Marathon'};if(s.indexOf('fondo')>-1||s.indexOf('etape')>-1||s.indexOf('cycle')>-1)return{lo:70,hi:100,mid:85,lbl:'Gran fondo'};return{lo:70,hi:90,mid:80,lbl:'Endurance race'};}
  var CSS=':root{--peacock:#6f8fb0 !important;--peacock2:#88a3bd !important}'
    +'#gv-fitness.gidon>*:not(#gidFit){display:none !important}#gidFit{display:flex;flex-direction:column;gap:12px}'
    +'.gf-card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px}'
    +'.gf-k{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--mut);font-weight:600;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center}'
    +'.gf-state{font-size:26px;font-weight:600;letter-spacing:-.01em}'
    +'.gf-sub{color:var(--mut);font-size:13px;margin-top:6px;line-height:1.45}'
    +'.gf-trio{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;margin-top:16px;background:var(--line);border:1px solid var(--line);border-radius:10px;overflow:hidden}'
    +'.gf-tile{background:var(--card);padding:12px 8px;text-align:center}.gf-tile .b{font-size:20px;font-weight:600}.gf-tile .c{font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--mut);margin-top:3px}'
    +'.gf-row{display:flex;justify-content:space-between;align-items:baseline;padding:8px 0;border-top:1px solid var(--line)}.gf-row:first-of-type{border-top:0}.gf-row .l{color:var(--mut);font-size:13px}.gf-row .v{font-weight:600;font-size:14px}'
    +'.gf-tag{font-size:11px;font-weight:600;letter-spacing:.04em;color:var(--mut)}'
    +'.gf-bar{height:4px;border-radius:3px;background:var(--line);overflow:hidden;margin:10px 0 4px;position:relative}.gf-bar>i{display:block;height:100%}'
    +'.gf-spark{display:flex;align-items:flex-end;gap:3px;height:34px;margin-top:10px}.gf-spark>i{flex:1;background:var(--mut);border-radius:1px;min-height:3px;opacity:.7}'
    +'.gf-goal{padding:11px 0;border-top:1px solid var(--line)}.gf-goal:first-child{border-top:0}.gf-gh{display:flex;justify-content:space-between;align-items:baseline}.gf-gs{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--mut)}'
    +'.gf-btn{background:none;border:1px solid var(--line);color:var(--ink);border-radius:8px;padding:5px 12px;font-size:12px;font-weight:600;cursor:pointer}.gf-btn:active{opacity:.7}'
    +'.gf-x{background:none;border:0;color:var(--mut);font-size:16px;cursor:pointer;line-height:1;padding:0 2px}'
    +'.gf-in{width:100%;background:#0e151d;border:1px solid var(--line);color:var(--ink);border-radius:8px;padding:9px 10px;font-size:13px;margin-top:8px;box-sizing:border-box}'
    +'.gf-two{display:grid;grid-template-columns:1fr 1fr;gap:8px}';
  function ckAvg(){
    var ks=Object.keys(localStorage).filter(function(k){return k.indexOf('app_checkin_')===0;}).sort();
    if(!ks.length) return null;
    var key=ks[ks.length-1], v=null; try{v=JSON.parse(localStorage.getItem(key));}catch(e){return null;}
    if(!v) return null;
    var parts=[v.legs,v.sleep,v.sore].filter(function(x){return typeof x==='number';});
    if(!parts.length) return null;
    var avg=parts.reduce(function(a,b){return a+b;},0)/parts.length;
    var d=key.replace('app_checkin_',''); var age=Math.round((Date.now()-new Date(d+'T12:00:00').getTime())/864e5);
    return {avg:avg, age:age, v:v};
  }
  function state(){
    var bigs=[].slice.call(document.querySelectorAll('.gauge .big'));
    var ctl=num(bigs[0]),atl=num(bigs[1]),tsb=num(bigs[2]);
    if(!isFinite(tsb)&&isFinite(ctl)&&isFinite(atl))tsb=ctl-atl;
    if(!(isFinite(ctl)&&isFinite(atl)&&ctl>0)) return null;
    var fr=fresh(tsb), ck=ckAvg();
    var subjLow=ck&&ck.avg<=2.5, subjMod=ck&&ck.avg>2.5&&ck.avg<=3.4;
    var head, sub, ageNote=ck?(ck.age>=2?' (check-in '+ck.age+'d old)':''):'';
    if(!ck){ head={w:fr.w,t:fr.t}; sub=fr.m+'. Log a check-in to factor recovery.'; }
    else if(subjLow){ head={w:'Under-recovered',t:'warn'}; sub='Form is '+(tsb>=0?'positive (+'+Math.round(tsb)+')':'negative ('+Math.round(tsb)+')')+', but your check-in reads low'+ageNote+' — keep today easy.'; }
    else if(subjMod){ head={w:fr.w,t:fr.t}; sub=fr.m+' · recovery moderate'+ageNote+'.'; }
    else { head={w:fr.w,t:fr.t}; sub=fr.m+' · recovery good.'; }
    return {ctl:ctl,atl:atl,tsb:tsb,acwr:atl/ctl,fr:fr,head:head,sub:sub,ck:ck,subjLow:subjLow};
  }
  function goals(){ try{return JSON.parse(localStorage.getItem('gid_goals')||'[]');}catch(e){return [];} }
  function saveGoals(g){ try{localStorage.setItem('gid_goals',JSON.stringify(g));}catch(e){} }
  function goalCurrent(gl){
    if(gl.current) return gl.current;
    var lab=(gl.label||'').toLowerCase(), pf=null; try{pf=JSON.parse(localStorage.getItem('app_profile')||localStorage.getItem('gid_profile')||'null');}catch(e){}
    if(pf&&lab.indexOf('ftp')>-1&&pf.ftp) return pf.ftp+' W';
    return null;
  }
  function goalsHTML(){
    var g=goals();
    var rows=g.map(function(gl){
      var cur=goalCurrent(gl), bar='';
      var tN=nnum(gl.target), cN=cur!=null?nnum(cur):null, isTime=(''+gl.target).indexOf(':')>-1;
      if(tN&&cN!=null&&!isTime){ var p=Math.max(3,Math.min(100,Math.round(cN/tN*100))); bar='<div class="gf-bar"><i style="width:'+p+'%;background:var(--good)"></i></div>'; }
      var right=(cur!=null?(E(cur)+' &rarr; '):'')+E(gl.target);
      return '<div class="gf-goal"><div class="gf-gh"><div><div class="gf-gs">'+E(gl.sport)+'</div><div style="font-weight:600;margin-top:2px">'+E(gl.label)+'</div></div><div style="text-align:right"><div class="v">'+right+'</div></div></div>'+bar+'<div style="text-align:right;margin-top:2px"><button class="gf-x" data-act="del" data-id="'+E(gl.id)+'">&times;</button></div></div>';
    }).join('');
    if(!g.length) rows='<div class="gf-sub" style="margin:0 0 10px">Set a target for running, cycling or swimming and track it against your fitness.</div>';
    return '<div class="gf-card" id="gfGoals"><div class="gf-k">Goals<button class="gf-btn" data-act="add">Add goal</button></div>'+rows+'</div>';
  }
  function formHTML(){
    return '<div class="gf-k">New goal<button class="gf-x" data-act="cancel">&times;</button></div>'
      +'<select class="gf-in" id="gfSport"><option>Running</option><option>Cycling</option><option>Swimming</option><option>General</option></select>'
      +'<input class="gf-in" id="gfLabel" placeholder="Goal (e.g. FTP 220 W, sub-45 10k, 4h/week)">'
      +'<div class="gf-two"><input class="gf-in" id="gfTarget" placeholder="Target (e.g. 220)"><input class="gf-in" id="gfCur" placeholder="Current (optional)"></div>'
      +'<div style="margin-top:12px;text-align:right"><button class="gf-btn" data-act="save">Save goal</button></div>';
  }
  function draw(){
    var fit=document.getElementById('gv-fitness'); if(!fit) return;
    try{
      var panel=document.getElementById('gidFit');
      if(!panel){panel=document.createElement('div');panel.id='gidFit';fit.insertBefore(panel,fit.firstChild);
        panel.addEventListener('click',function(ev){var el=ev.target.closest('[data-act]');if(!el)return;var act=el.getAttribute('data-act');
          if(act==='add'){panel.dataset.editing='1';var gc=document.getElementById('gfGoals');if(gc)gc.innerHTML=formHTML();}
          else if(act==='cancel'){panel.dataset.editing='';panel.removeAttribute('data-sig');draw();}
          else if(act==='save'){var sp=document.getElementById('gfSport'),lb=document.getElementById('gfLabel'),tg=document.getElementById('gfTarget'),cu=document.getElementById('gfCur');
            if(lb&&lb.value.trim()){var g=goals();g.push({id:'g'+Date.now(),sport:sp?sp.value:'General',label:lb.value.trim(),target:tg?tg.value.trim():'',current:cu&&cu.value.trim()?cu.value.trim():''});saveGoals(g);}
            panel.dataset.editing='';panel.removeAttribute('data-sig');draw();}
          else if(act==='del'){var id=el.getAttribute('data-id');saveGoals(goals().filter(function(x){return x.id!==id;}));panel.removeAttribute('data-sig');draw();}
        });
      }
      fit.classList.add('gidon');
      if(panel.dataset.editing==='1') return;
      var s=state();
      if(!s){panel.innerHTML='<div class="gf-card"><div class="gf-k">Fitness</div><div class="gf-sub">Connect Strava to see fitness, form and race projection.</div></div>';return;}
      var ctl=s.ctl,atl=s.atl,tsb=s.tsb,acwr=s.acwr;
      var tl=chart('trendLine'),ctlS=[],dc;if(tl){dc=tl.data.datasets.filter(function(d){return /CTL/i.test(d.label);})[0];if(dc)ctlS=dc.data.slice();}
      var wk=chart('trend'),weekly=[];if(wk&&wk.data.datasets[0])weekly=wk.data.datasets[0].data.slice();
      var lastWk=weekly.length?weekly[weekly.length-1]:null, peak=ctlS.length?Math.max.apply(null,ctlS):ctl, maxWk=weekly.length?Math.max.apply(null,weekly):null;
      var race=null;try{var rs=JSON.parse(localStorage.getItem('app_races')||'[]');if(rs&&rs.length)race=rs[0];}catch(e){}
      var weeks=null,proj=null,bd=null;
      if(race&&race.date){var d1=new Date(race.date+'T00:00:00'),nw=new Date();nw.setHours(0,0,0,0);weeks=Math.max(0,Math.round((d1-nw)/6048e5));}
      if(lastWk!=null)proj=Math.round(lastWk/7);
      if(race)bd=band(race.name||race.meta);
      var rdy=null;try{rdy=JSON.parse(localStorage.getItem('gid_readiness')||'null');}catch(e){}
      var hist=[];try{hist=JSON.parse(localStorage.getItem('gid_rdyhist')||'[]');}catch(e){}
      var tdy=new Date().toISOString().slice(0,10);
      if(rdy&&rdy.score!=null){if(!hist.length||hist[hist.length-1].d!==tdy)hist.push({d:tdy,s:Math.round(rdy.score)});else hist[hist.length-1].s=Math.round(rdy.score);hist=hist.slice(-14);try{localStorage.setItem('gid_rdyhist',JSON.stringify(hist));}catch(e){}}
      var H='';
      H+='<div class="gf-card"><div class="gf-k">Form</div><div class="gf-state" style="color:'+tone(s.head.t)+'">'+E(s.head.w)+'</div><div class="gf-sub">'+E(s.sub)+'</div>'
        +'<div class="gf-trio"><div class="gf-tile"><div class="b">'+Math.round(ctl)+'</div><div class="c">Fitness</div></div><div class="gf-tile"><div class="b">'+Math.round(atl)+'</div><div class="c">Fatigue</div></div><div class="gf-tile"><div class="b">'+(tsb>=0?'+':'')+Math.round(tsb)+'</div><div class="c">Form (TSB)</div></div></div></div>';
      if(race&&bd){
        var cur=Math.round(ctl),tgt=bd.mid,pj=proj!=null?proj:cur,gap=tgt-pj;
        var stt=gap<=2?{w:'On track',t:'good'}:(gap<=12?{w:'Slightly behind',t:'warn'}:{w:'Build required',t:'warn'});
        var pct=Math.max(3,Math.min(100,Math.round(cur/bd.hi*100))),tp=Math.max(3,Math.min(100,Math.round(tgt/bd.hi*100)));
        var pctUp=Math.round((tgt/Math.max(1,pj)-1)*100);
        H+='<div class="gf-card"><div class="gf-k">'+E(race.name||'Race')+'<span class="gf-tag" style="color:'+tone(stt.t)+'">'+stt.w+'</span></div>'
          +'<div class="gf-bar"><i style="width:'+pct+'%;background:'+tone(s.head.t==='bad'?'warn':'good')+'"></i><span style="position:absolute;top:-4px;left:'+tp+'%;width:2px;height:12px;background:var(--ink)"></span></div>'
          +'<div class="gf-row"><span class="l">'+(weeks!=null?weeks+' weeks out':'Timing')+'</span><span class="v">'+(weeks!=null?'':'—')+'</span></div>'
          +'<div class="gf-row"><span class="l">Fitness now</span><span class="v">'+cur+'</span></div>'
          +'<div class="gf-row"><span class="l">Projected at current load</span><span class="v">'+pj+'</span></div>'
          +'<div class="gf-row"><span class="l">Needed ('+bd.lbl+')</span><span class="v">'+bd.lo+'–'+bd.hi+'</span></div>'
          +'<div class="gf-sub">'+(gap>2?('Raise weekly load about '+pctUp+'%, building 3–5 points a week.'):'You are within the target range — hold and sharpen.')+' Estimate.</div></div>';
      }
      H+='<div class="gf-card"><div class="gf-k">Performance</div><div class="gf-row"><span class="l">Peak fitness (8 wks)</span><span class="v">'+Math.round(peak)+'</span></div><div class="gf-row"><span class="l">Now vs peak</span><span class="v">'+(peak>0?Math.round((ctl/peak-1)*100):0)+'%</span></div>'+(maxWk!=null?'<div class="gf-row"><span class="l">Biggest week</span><span class="v">'+Math.round(maxWk)+'</span></div>':'')+(lastWk!=null?'<div class="gf-row"><span class="l">This week</span><span class="v">'+Math.round(lastWk)+'</span></div>':'')+'</div>';
      var rb=rdy&&rdy.band?rdy.band:'',rt=rb==='green'?'good':rb==='amber'?'warn':rb==='red'?'bad':'mut';
      var sv=hist.map(function(h){return h.s;}),sm=sv.length?Math.max.apply(null,sv):100;
      var sp2=hist.map(function(h){return '<i style="height:'+Math.max(6,Math.round(h.s/(sm||100)*34))+'px"></i>';}).join('');
      H+='<div class="gf-card"><div class="gf-k">Recovery</div>'+(rdy&&rdy.score!=null?'<div class="gf-row"><span class="l">Readiness</span><span class="v" style="color:'+tone(rt)+'">'+Math.round(rdy.score)+' · '+E(rb)+'</span></div>':'')+'<div class="gf-row"><span class="l">Load ratio</span><span class="v" style="color:'+(acwr>1.3?'var(--bad)':'var(--mut)')+'">'+acwr.toFixed(2)+'</span></div>'+(s.ck?'<div class="gf-row"><span class="l">Last check-in</span><span class="v">legs '+s.ck.v.legs+'/5 · sleep '+s.ck.v.sleep+'/5</span></div>':'')+(hist.length>1?'<div class="gf-spark">'+sp2+'</div>':'<div class="gf-sub">Log check-ins to build a recovery trend.</div>')+'</div>';
      H+=goalsHTML();
      H+='<div class="gf-card"><div class="gf-k">Balance · 28 days</div>'+(function(){var bal=chart('balance');if(!bal)return '<div class="gf-sub">No recent activity.</div>';var lb=bal.data.labels||[],da=(bal.data.datasets[0]||{}).data||[],tt=da.reduce(function(a,b){return a+(+b||0);},0)||1;if(!lb.length)return '<div class="gf-sub">No recent activity.</div>';var col={run:'var(--run)',ride:'var(--ride)',bike:'var(--ride)',swim:'var(--swim)'};return lb.map(function(l,i){var nm=(''+l).replace(/[^A-Za-z].*$/,'')||(''+l),k=nm.toLowerCase(),cc=col[k]||'var(--mut)',p=Math.round((da[i]||0)/tt*100);return '<div class="gf-row"><span class="l">'+E(nm)+'</span><span class="v">'+p+'%</span></div><div class="gf-bar"><i style="width:'+p+'%;background:'+cc+'"></i></div>';}).join('');})()+'</div>';
      var gStr=''; try{gStr=localStorage.getItem('gid_goals')||'';}catch(e){}
      var sig=[Math.round(ctl),Math.round(atl),Math.round(tsb),weeks,hist.length,s.head.w,gStr.length].join('|');
      if(panel.getAttribute('data-sig')!==sig){panel.innerHTML=H;panel.setAttribute('data-sig',sig);}
    }catch(e){ fit.classList.remove('gidon'); }
  }
  var STRIP=[0x1F3AF,0x2728,0x2726,0x1F4C8,0x1F4C5,0x1F5D3,0x1F37D,0x1F321,0x1F3C1];
  var REP=[['· AI-tailored',''],['· AI-Tailored',''],['· AI-TAILORED',''],['AI-tailored',''],['AI-TAILORED',''],["The Coach's Read",'Coach notes'],["Coach's Read",'Coach notes'],['tailoring feedback',''],['Guide only.',''],['Train for it:','Focus:'],['weeks to go','weeks out']];
  function janitor(){
    try{
      var s=state();
      var gr=document.querySelector('#gidReady .gr-verdict');
      if(gr&&s){ var rb=(function(){try{var r=JSON.parse(localStorage.getItem('gid_readiness')||'null');return r?r.band:'';}catch(e){return '';}})();
        var v = s.subjLow ? 'Under-recovered — keep it easy today' : (rb==='green'?'Ready for a quality session':rb==='amber'?'Easy aerobic — no hard efforts':rb==='red'?'Recovery day':'Steady aerobic');
        if(gr.textContent!==v) gr.textContent=v; }
      var walk=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,null),n;
      while((n=walk.nextNode())){
        var p=n.parentElement; if(!p) continue; var tag=p.tagName;
        if(tag==='SCRIPT'||tag==='STYLE'||tag==='TEXTAREA'||tag==='INPUT') continue;
        if(p.closest('#gidFit')||p.closest('#gidReady')) continue;
        var t=n.nodeValue, o=t;
        for(var i=0;i<REP.length;i++){ if(t.indexOf(REP[i][0])>-1) t=t.split(REP[i][0]).join(REP[i][1]); }
        if(/[✀-➿]|[�-�]/.test(t)){ var out=''; for(var k=0;k<t.length;k++){ var cp=t.codePointAt(k); if(cp>0xFFFF)k++; if(STRIP.indexOf(cp)<0) out+=String.fromCodePoint(cp); } t=out; }
        if(t!==o) n.nodeValue=t.replace(/\s+·\s*$/,'').replace(/^\s+·\s*/,'');
      }
    }catch(e){}
  }
  var st=document.getElementById('gidFitCss');if(!st){st=document.createElement('style');st.id='gidFitCss';st.textContent=CSS;document.head.appendChild(st);}
  setInterval(function(){draw();janitor();},1500);setTimeout(function(){draw();janitor();},400);setTimeout(function(){draw();janitor();},1200);
})();

;(function(){
  var NL=String.fromCharCode(10);
  function E(s){s=(s==null?'':''+s);return s.split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;');}
  function two(n){return (n<10?'0':'')+n;}
  function tstr(){var d=new Date();return d.getFullYear()+'-'+two(d.getMonth()+1)+'-'+two(d.getDate());}
  function pf(el){return el?parseFloat((el.textContent||'').replace(/[^0-9.-]/g,'')):NaN;}
  function gauges(){var b=[].slice.call(document.querySelectorAll('.gauge .big'));return {ctl:pf(b[0]),atl:pf(b[1]),tsb:pf(b[2])};}
  function lastCk(){var ks=Object.keys(localStorage).filter(function(k){return k.indexOf('app_checkin_')===0;}).sort();if(!ks.length)return null;var v=null;try{v=JSON.parse(localStorage.getItem(ks[ks.length-1]));}catch(e){return null;}if(!v)return null;var parts=[v.legs,v.sleep,v.sore].filter(function(x){return typeof x==='number';});if(!parts.length)return null;return {avg:parts.reduce(function(a,b){return a+b;},0)/parts.length,v:v};}
  function week(){try{var w=JSON.parse(localStorage.getItem('gid_week')||'null');return w&&w.sessions?w:null;}catch(e){return null;}}
  var ACTS=null,ATS=0,BUSY=false,MSG='';
  function loadActs(){if(ACTS&&Date.now()-ATS<300000)return;ATS=Date.now();fetch('/api/u/activities',{credentials:'include'}).then(function(r){return r.json();}).then(function(j){var a=Array.isArray(j)?j:(j.activities||[]);ACTS=a.map(function(x){return {d:(''+(x.start_local||'')).slice(0,10),min:Math.round((((x.summary||{}).moving_time)||0)/60)};});}).catch(function(){ACTS=[];});}
  function isRest(x){return x.rest||(''+x.sport).toLowerCase()==='rest';}
  function analyse(){var w=week();if(!w)return null;var s=w.sessions,t=tstr(),done=0,missed=0,fut=0,misses=[],future=[];
    s.forEach(function(x){
      if(x.date<t){ if(isRest(x))return; var hit=ACTS&&ACTS.some(function(a){return a.d===x.date&&a.min>0;}); if(hit)done++;else{missed++;misses.push(x);} }
      else if(x.date===t){ if(isRest(x))return; var h2=ACTS&&ACTS.some(function(a){return a.d===t&&a.min>0;}); if(h2)done++; }
      else { if(!isRest(x))fut++; future.push(x); }
    });
    var maxd=s.length?s[s.length-1].date:'';
    return {w:w,s:s,done:done,missed:missed,fut:fut,misses:misses,future:future,t:t,active:maxd>=t};
  }
  function render(){
    var sc=document.getElementById('gv-schedule'); if(!sc) return; loadActs();
    var card=document.getElementById('gidAdapt'), anchor=document.getElementById('gidWeek');
    if(!card){card=document.createElement('div');card.id='gidAdapt';card.className='gf-card';if(anchor&&anchor.parentNode)anchor.parentNode.insertBefore(card,anchor.nextSibling);else sc.insertBefore(card,sc.firstChild);
      card.addEventListener('click',function(ev){var el=ev.target.closest('[data-act]');if(!el)return;if(el.getAttribute('data-act')==='rebal')rebalance();});}
    if(BUSY)return;
    var a=analyse();
    if(!a||!a.active){card.style.display='none';return;} card.style.display='';
    var g=gauges(),ck=lastCk();var acwr=(g.ctl>0)?g.atl/g.ctl:null;var subjLow=ck&&ck.avg<=2.5;
    var futN=a.future.filter(function(x){return !isRest(x);}).length;
    var need=(a.missed>0||subjLow||(acwr&&acwr>1.3))&&futN>0;
    var reasons=[];if(a.missed>0)reasons.push(a.missed+' missed');if(subjLow)reasons.push('under-recovered');if(acwr&&acwr>1.3)reasons.push('load ramping');
    var tag=need?'<span class="gf-tag" style="color:var(--warn)">Rebalance suggested</span>':'<span class="gf-tag" style="color:var(--good)">On track</span>';
    var H='<div class="gf-k">This week'+tag+'</div><div class="gf-sub" style="margin-top:0">'+a.done+' done · '+a.missed+' missed · '+a.fut+' to go'+(reasons.length?' — '+E(reasons.join(', ')):'')+'.</div>';
    var rem=a.future.slice(0,7).map(function(x){return '<div class="gf-row"><span class="l">'+E(x.dow||x.date.slice(5))+'</span><span class="v">'+(isRest(x)?'Rest':(E(x.sport)+' · '+x.durationMin+'m · '+E(x.focus)))+'</span></div>';}).join('');
    if(rem)H+='<div style="margin-top:8px">'+rem+'</div>';
    if(need)H+='<div style="margin-top:12px"><button class="gf-btn" data-act="rebal">Rebalance remaining days</button></div>';
    if(MSG)H+='<div class="gf-sub" style="margin-top:12px">'+E(MSG)+'</div>';
    var sig=[a.done,a.missed,a.fut,subjLow,MSG,a.future.map(function(x){return x.sport+x.durationMin+x.focus;}).join(',')].join('|');
    if(card.getAttribute('data-sig')!==sig){card.innerHTML=H;card.setAttribute('data-sig',sig);}
  }
  function rebalance(){
    if(BUSY)return;var a=analyse();if(!a)return;var g=gauges(),ck=lastCk();
    BUSY=true;MSG='';var card=document.getElementById('gidAdapt');
    if(card){card.removeAttribute('data-sig');card.innerHTML='<div class="gf-k">Rebalancing</div><div class="gf-sub">Rebuilding your remaining days around what you have done and how you are recovering.</div>';}
    var acwr=(g.ctl>0)?(g.atl/g.ctl).toFixed(2):'unknown';var subjLow=ck&&ck.avg<=2.5;
    var future=a.future,fset={};future.forEach(function(x){fset[x.date]=1;});
    var race=null;try{var rs=JSON.parse(localStorage.getItem('app_races')||'[]');if(rs.length)race=rs[0];}catch(e){}
    var weeks=null;if(race&&race.date){weeks=Math.round((new Date(race.date+'T00:00:00')-new Date(a.t+'T00:00:00'))/6048e5);}
    var prof=null;try{prof=JSON.parse(localStorage.getItem('app_profile')||localStorage.getItem('gid_profile')||'null');}catch(e){}
    var sports=prof&&prof.sports?(Array.isArray(prof.sports)?prof.sports.join(", "):prof.sports):'';
    var m="You are my endurance coach. Rebuild ONLY the remaining days of my current training week. ";
    m+="Today is "+a.t+". My form (TSB) is "+Math.round(g.tsb)+", fitness (CTL) "+Math.round(g.ctl)+", acute-to-chronic load ratio "+acwr+". ";
    if(ck)m+="Latest check-in on a 1 to 5 scale: legs "+ck.v.legs+", sleep "+ck.v.sleep+", soreness "+ck.v.sore+". ";
    if(subjLow)m+="I am under-recovered right now. ";
    if(a.missed>0)m+="I MISSED these sessions this week: "+a.misses.map(function(x){return x.dow+" "+x.sport+" "+x.durationMin+"min "+x.focus;}).join("; ")+". ";
    m+="Remaining planned days: "+future.map(function(x){return x.date+" "+x.dow+" "+x.sport+" "+x.durationMin+"min "+x.focus;}).join("; ")+". ";
    if(weeks!=null)m+="My A-race is in "+weeks+" weeks. ";
    m+="RULES: do not cram missed volume into the remaining days; protect the single most important long or quality session; if I am under-recovered or the load ratio is above 1.3, make the next one or two days easy or rest; keep it polarised, mostly easy with at most one or two hard days and never hard on back to back days; ";
    if(sports)m+="only use these sports: "+sports+"; ";
    m+="if the race is within 2 weeks, taper. ";
    m+='OUTPUT FORMAT: first line "WHY: one short sentence". Then exactly one line for each remaining day in order, each line exactly "DATE | SPORT | MINUTES | short focus" where DATE is YYYY-MM-DD and rest days use SPORT Rest and MINUTES 0. No other text and no markdown.';
    fetch('/api/u/ai',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:m})}).then(function(r){return r.json();}).then(function(j){
      var reply=(j&&j.reply)||'';var lines=reply.split(NL).map(function(s){return s.trim();}).filter(function(s){return s;});
      var why='',out=[];
      lines.forEach(function(l){if(l.slice(0,4).toUpperCase()==='WHY:'){why=l.slice(4).trim();return;}var parts=l.split('|').map(function(x){return x.trim();});if(parts.length>=4){var dt=parts[0];if(dt.length===10&&dt.charAt(4)==='-'&&dt.charAt(7)==='-'){out.push({date:dt,sport:parts[1],min:parseInt(parts[2],10)||0,focus:parts[3]});}}});
      var applied=0;if(out.length){var w=a.w;out.forEach(function(n){if(!fset[n.date])return;var r2=(''+n.sport).toLowerCase().indexOf('rest')>-1||n.min===0;for(var i=0;i<w.sessions.length;i++){if(w.sessions[i].date===n.date){w.sessions[i].sport=n.sport;w.sessions[i].durationMin=n.min;w.sessions[i].focus=n.focus;w.sessions[i].rest=r2;applied++;break;}}});
        try{localStorage.setItem('gid_week',JSON.stringify(w));}catch(e){}}
      MSG=applied?((why?why+' ':'')+'Updated '+applied+' day'+(applied>1?'s':'')+'. Tap Add to calendar above to sync.'):'Could not read a new plan. Please try again.';
      BUSY=false;var c2=document.getElementById('gidAdapt');if(c2)c2.removeAttribute('data-sig');render();
    }).catch(function(){MSG='Rebalance failed. Check your connection and retry.';BUSY=false;var c3=document.getElementById('gidAdapt');if(c3)c3.removeAttribute('data-sig');render();});
  }
  setInterval(render,1600);setTimeout(render,900);
})();
