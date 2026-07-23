// POST /api/u/calwrite → write (or clear) the user's Cyprus training plan on their Google Calendar.
// Body:
//   { action:'sync', calendarId?, tz, sessions:[{date:'YYYY-MM-DD', time:'HH:MM', durationMin, title, sport, focus}] }
//   { action:'clear', calendarId? }
// SAFETY: only ever creates or removes events the app itself tagged
// (extendedProperties.private.cyprusPlan='1'). It never reads, edits, or deletes the user's own events.
// Auth: the caller's own g_rt cookie. Requires the calendar.events scope (re-consent).

function getCookie(req, name) {
  const c = req.headers.get('Cookie') || '';
  const m = c.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}
function json(o, st) {
  return new Response(JSON.stringify(o), { status: st || 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
async function accessToken(env, rt) {
  const body = new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, grant_type: 'refresh_token', refresh_token: rt });
  const tr = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  const td = await tr.json();
  return td.access_token || null;
}
function pad(n) { return (n < 10 ? '0' : '') + n; }
// add minutes to a HH:MM wall-clock, returning { time, dayShift }
function addMinutes(hhmm, mins) {
  const parts = String(hhmm).split(':');
  let total = (parseInt(parts[0], 10) || 6) * 60 + (parseInt(parts[1], 10) || 0) + mins;
  const dayShift = Math.floor(total / 1440);
  total = ((total % 1440) + 1440) % 1440;
  return { time: pad(Math.floor(total / 60)) + ':' + pad(total % 60), dayShift };
}
function shiftDate(ymd, days) {
  if (!days) return ymd;
  const d = new Date(ymd + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
// Sport → Google colorId (7 peacock, 6 tangerine, 9 blueberry, 5 banana, 2 sage, 8 graphite)
const SPORT_COLOR = { run: '6', ride: '7', bike: '7', cycle: '7', cycling: '7', swim: '9', strength: '5', gym: '5', mobility: '2', rest: '8', other: '2' };
function colorFor(sport, title) {
  const s = (sport || title || '').toLowerCase();
  for (const k in SPORT_COLOR) if (s.indexOf(k) > -1) return SPORT_COLOR[k];
  return '2';
}

// Remove only app-created events in the window (strictly cyprusPlan-tagged).
async function clearCyprus(at, cal, timeMin, timeMax) {
  const q = `https://www.googleapis.com/calendar/v3/calendars/${cal}/events`
    + `?privateExtendedProperty=${encodeURIComponent('cyprusPlan=1')}`
    + `&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`
    + `&singleEvents=true&maxResults=250`;
  const r = await fetch(q, { headers: { Authorization: `Bearer ${at}` } });
  if (!r.ok) return { removed: 0, status: r.status };
  const d = await r.json();
  let removed = 0;
  for (const ev of (d.items || [])) {
    const del = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${cal}/events/${ev.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${at}` } });
    if (del.ok || del.status === 410 || del.status === 204) removed++;
  }
  return { removed, status: 200 };
}

export async function onRequestPost({ request, env }) {
  const rt = getCookie(request, 'g_rt');
  if (!rt) return json({ error: 'not_connected', needAuth: true }, 401);

  let b = {}; try { b = await request.json(); } catch (e) {}
  const cal = encodeURIComponent(b.calendarId || getCookie(request, 'cal_id') || 'primary');
  const tz = (typeof b.tz === 'string' && b.tz) ? b.tz : 'UTC';

  const at = await accessToken(env, rt);
  if (!at) return json({ error: 'google_token' }, 502);

  // window: yesterday → +9 days (covers a 7-day plan starting today)
  const now = Date.now();
  const winMin = new Date(now - 1 * 864e5).toISOString();
  const winMax = new Date(now + 9 * 864e5).toISOString();

  if (b.action === 'clear') {
    const c = await clearCyprus(at, cal, winMin, winMax);
    if (c.status === 401 || c.status === 403) return json({ error: 'need_write', needReconnect: true }, 200);
    return json({ cleared: c.removed });
  }

  // sync: clear our prior events in the window, then insert fresh
  const sessions = Array.isArray(b.sessions) ? b.sessions : [];
  const cleared = await clearCyprus(at, cal, winMin, winMax);
  if (cleared.status === 401 || cleared.status === 403) return json({ error: 'need_write', needReconnect: true }, 200);

  let created = 0; const errs = [];
  for (const s of sessions) {
    if (!s || !s.date) continue;
    const dur = Math.max(15, Math.min(300, parseInt(s.durationMin, 10) || 60));
    const time = /^\d{1,2}:\d{2}$/.test(s.time || '') ? (String(s.time).length === 4 ? '0' + s.time : s.time) : '06:00';
    const isRest = /rest/i.test(s.sport || '') || /rest/i.test(s.title || '');
    const end = addMinutes(time, isRest ? 30 : dur);
    const ev = {
      summary: '🔵 Cyprus · ' + (s.title || ((s.sport || 'Session') + ' ' + dur + 'min')),
      description: (s.focus ? s.focus + '\n\n' : '') + 'Auto-added by Cyprus — your AI training plan. Edit or delete freely; regenerating replaces these.',
      start: { dateTime: s.date + 'T' + time + ':00', timeZone: tz },
      end: { dateTime: shiftDate(s.date, end.dayShift) + 'T' + end.time + ':00', timeZone: tz },
      colorId: colorFor(s.sport, s.title),
      extendedProperties: { private: { cyprusPlan: '1' } },
      reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 60 }] },
    };
    const ins = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${cal}/events`, {
      method: 'POST', headers: { Authorization: `Bearer ${at}`, 'Content-Type': 'application/json' }, body: JSON.stringify(ev),
    });
    if (ins.ok) { created++; }
    else {
      if (ins.status === 401 || ins.status === 403) return json({ error: 'need_write', needReconnect: true, created }, 200);
      errs.push(ins.status);
    }
  }
  return json({ created, removed: cleared.removed, errors: errs.slice(0, 5) });
}
