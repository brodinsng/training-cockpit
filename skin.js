/* ============================================================================
   Training Cockpit — "Dark & Focused" skin (v1)
   A non-invasive redesign layer. It only:
     1. Repaints the app to a dark, high-contrast theme (via CSS-variable override).
     2. Makes the Chart.js charts dark-aware.
     3. Adds a sticky app header and a native-style bottom tab bar.
   It never changes the app's data logic. Remove the <script src="/skin.js">
   line from index.html to fully revert.
   ============================================================================ */
(function () {
  'use strict';

  /* ---------- 1. Dark theme (the app is built on CSS variables, so
                   redefining them recolours nearly everything cleanly) ------- */
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
    body{padding-top:64px !important;padding-bottom:96px !important;
      -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;}
    .wrap{max-width:640px;}
    /* cards */
    .card{background:var(--card) !important;border:1px solid var(--line) !important;
      border-radius:18px !important;box-shadow:0 1px 0 rgba(255,255,255,.02) inset;}
    /* section headings — quieter, tighter, app-like */
    h2{color:var(--mut) !important;font-size:12px !important;letter-spacing:1.6px !important;
      margin:30px 6px 12px !important;}
    .sub,.muted,.loading{color:var(--mut) !important;}
    /* the original page title is replaced by the sticky header */
    .wrap>h1{display:none !important;}
    .wrap>.sub:first-of-type{display:none !important;}
    /* big metric numbers — the heart of a "focused" dark dashboard */
    .gauge .big{font-size:46px !important;font-weight:800 !important;letter-spacing:-1px !important;
      line-height:1 !important;}
    .gauge .cap{color:var(--mut) !important;letter-spacing:1px;}
    .rk .v{font-size:26px !important;font-weight:800 !important;}
    /* inputs / fields → dark */
    input,textarea,select{background:#0e151d !important;color:var(--ink) !important;
      border:1px solid var(--line) !important;border-radius:10px !important;}
    input::placeholder,textarea::placeholder{color:#5c6a7a !important;}
    /* buttons keep the accent but read on dark */
    .addform button,.genbtn,button{border-radius:10px !important;}
    /* highlight chips (state/verdict/flag) were light — dark-ify with an accent edge */
    .state,.verdict,.flag{background:#10171f !important;color:var(--ink) !important;
      border:1px solid var(--line) !important;border-left:3px solid var(--peacock) !important;}
    .flag{border-left-color:var(--warn) !important;}
    /* dividers inside stat/session/todo rows */
    .stat,.sess,.todo,.meal,.vol{border-color:var(--line) !important;}
    .track{background:#0e151d !important;}
    /* race countdown tiles */
    .u{background:var(--sky) !important;}
    /* schedule session bars & done/skip mini buttons */
    .mini{background:#0e151d !important;border-color:var(--line) !important;color:var(--mut) !important;}
    /* connect / onboarding buttons stay bold */
    a[href*="/api/auth"],.connect,.cbtn{border-radius:12px !important;}
    /* ===== sticky app header ===== */
    #skinHeader{position:fixed;top:0;left:0;right:0;height:56px;z-index:50;
      display:flex;flex-direction:column;justify-content:center;padding:8px 18px;
      background:rgba(10,14,19,.82);backdrop-filter:saturate(160%) blur(14px);
      -webkit-backdrop-filter:saturate(160%) blur(14px);
      border-bottom:1px solid var(--line);}
    #skinHeader .t{font-size:16px;font-weight:800;letter-spacing:.3px;color:var(--ink);
      display:flex;align-items:center;gap:8px;}
    #skinHeader .dot{width:7px;height:7px;border-radius:50%;background:var(--good);
      box-shadow:0 0 8px var(--good);}
    #skinHeader .s{font-size:11px;color:var(--mut);margin-top:1px;
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    /* ===== bottom tab bar ===== */
    #skinTabs{position:fixed;left:0;right:0;bottom:0;z-index:50;display:flex;
      background:rgba(10,14,19,.9);backdrop-filter:saturate(160%) blur(14px);
      -webkit-backdrop-filter:saturate(160%) blur(14px);
      border-top:1px solid var(--line);
      padding:6px 6px calc(6px + env(safe-area-inset-bottom));}
    #skinTabs button{flex:1;background:none !important;border:none !important;
      display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px 0 !important;
      color:var(--mut) !important;font-size:10px !important;font-weight:700 !important;
      letter-spacing:.4px;cursor:pointer;transition:color .15s;}
    #skinTabs button .ic{font-size:19px;line-height:1;}
    #skinTabs button.on{color:var(--peacock) !important;}
    #skinTabs button.on .ic{filter:drop-shadow(0 0 6px rgba(56,189,248,.5));}
  `;
  var st = document.createElement('style');
  st.id = 'skin';
  st.textContent = css;
  document.head.appendChild(st);

  /* mobile status-bar colour */
  var tc = document.querySelector('meta[name="theme-color"]');
  if (tc) tc.setAttribute('content', '#0a0e13');

  /* ---------- 2. Chart.js dark defaults (set before the app renders charts) -- */
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
  if (!tuneCharts()) {
    var tries = 0, iv = setInterval(function () {
      if (tuneCharts() || ++tries > 40) clearInterval(iv);
    }, 50);
  }

  /* ---------- 3. Header + bottom tab bar (built after DOM is ready) ---------- */
  function build() {
    try {
      if (document.getElementById('skinHeader')) return;

      /* header: title + the live status line (relocated so it keeps updating) */
      var header = document.createElement('div');
      header.id = 'skinHeader';
      var title = document.createElement('div');
      title.className = 't';
      title.innerHTML = '<span class="dot"></span>Training Cockpit';
      header.appendChild(title);
      var sub = document.getElementById('sub');
      if (sub) { sub.classList.add('s'); header.appendChild(sub); sub.style.display = ''; }
      document.body.appendChild(header);

      /* find the anchor section headings for each tab (read-only) */
      var h2s = Array.prototype.slice.call(document.querySelectorAll('.wrap h2'));
      function anchor(words) {
        for (var i = 0; i < h2s.length; i++) {
          var t = (h2s[i].textContent || '').toLowerCase();
          for (var j = 0; j < words.length; j++) if (t.indexOf(words[j]) > -1) return h2s[i];
        }
        return null;
      }
      var targets = {
        today:    anchor(['a-race', 'race countdown', 'today']),
        fitness:  anchor(['fatigue', 'fitness']),
        schedule: anchor(["what's next", 'schedule']),
        fuel:     anchor(['meal', 'fuel'])
      };

      /* if the dashboard isn't on screen (e.g. the connect screen), skip the bar */
      var haveAny = targets.today || targets.fitness || targets.schedule || targets.fuel;
      if (!haveAny) return;

      var defs = [
        ['today', '◎', 'Today'],
        ['fitness', '📈', 'Fitness'],
        ['schedule', '🗓', 'Schedule'],
        ['fuel', '🍽', 'Fuel']
      ];
      var tabs = document.createElement('div');
      tabs.id = 'skinTabs';
      var buttons = {};
      defs.forEach(function (d) {
        var key = d[0];
        var b = document.createElement('button');
        b.innerHTML = '<span class="ic">' + d[1] + '</span>' + d[2];
        b.addEventListener('click', function () {
          if (key === 'today') { window.scrollTo({ top: 0, behavior: 'smooth' }); }
          else if (targets[key]) {
            var y = targets[key].getBoundingClientRect().top + window.pageYOffset - 64;
            window.scrollTo({ top: y, behavior: 'smooth' });
          }
          setActive(key);
        });
        if (!targets[key] && key !== 'today') b.style.opacity = '.35';
        tabs.appendChild(b);
        buttons[key] = b;
      });
      document.body.appendChild(tabs);

      function setActive(key) {
        defs.forEach(function (d) { buttons[d[0]].classList.toggle('on', d[0] === key); });
      }
      setActive('today');

      /* scroll-spy: light-up the tab whose section you're nearest */
      var order = ['fuel', 'schedule', 'fitness', 'today'];
      var spy = null;
      window.addEventListener('scroll', function () {
        if (spy) return;
        spy = requestAnimationFrame(function () {
          spy = null;
          var mid = window.pageYOffset + 90;
          var pick = 'today';
          for (var i = 0; i < order.length; i++) {
            var el = targets[order[i]];
            if (el && el.offsetTop <= mid) { pick = order[i]; break; }
          }
          setActive(pick);
        });
      }, { passive: true });
    } catch (e) { /* redesign is best-effort; never break the app */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
  /* rebuild once more shortly after load in case the dashboard mounts late */
  setTimeout(build, 1200);
})();
