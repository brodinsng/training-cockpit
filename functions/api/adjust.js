// GET /api/adjust?readiness=red|amber
// Auto-softens TODAY's training session on the B&G calendar based on the check-in.
// SAFE: only Brodin's own peacock (colorId 7) training event, for today only. Appends a
// reversible tag, stashes the original title in the description, is idempotent, never deletes.
// Uses the env Google token (needs calendar WRITE scope; a read-only token returns needAuth).

function j(o, status) {
  return new Response(JSON.stringify(o), { status: status || 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
async function googleAccessToken(env) {
  const body = new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, grant_type: 'refresh_token', refresh_token: env.GOOGLE_REFRESH_TOKEN });
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  const d = await res.json();
  if (!d.access_token) throw new Error('google token: ' + JSON.stringify(d));
  return d.access_token;
}
const TRAIN_IN = /\b(run|ride|swim|brick|track|five45|ccp|bike|base|z2|threshold|tempo|interval|long run|easy run|smash)\b/i;

export async function onRequestGet({ request, env }) {
  const readiness = (new URL(request.url).searchParams.get('readiness') || '').toLowerCase();
  if (readiness !== 'red' && readiness !== 'amber') return j({ changed: false, message: 'Green day — no calendar change.' });
  try {
    const token = await googleAccessToken(env);
    const cal = encodeURIComponent(env.CAL_ID);
    // today's window in Singapore time
    const sg = new Date(Date.now() + 8 * 3600 * 1000);
    const y = sg.getUTCFullYear(), mo = String(sg.getUTCMonth() + 1).padStart(2, '0'), da = String(sg.getUTCDate()).padStart(2, '0');
    const timeMin = `${y}-${mo}-${da}T00:00:00+08:00`, timeMax = `${y}-${mo}-${da}T23:59:59+08:00`;
    const listUrl = `https://www.googleapis.com/calendar/v3/calendars/${cal}/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=50`;
    const lr = await fetch(listUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!lr.ok) return j({ changed: false, error: 'couldn’t read calendar (' + lr.status + ')', needAuth: lr.status === 401 });
    const data = await lr.json();
    const items = data.items || [];
    const ev = items.find((e) => e.colorId === '7' && TRAIN_IN.test(e.summary || '') && !/\(auto:/i.test(e.summary || ''));
    if (!ev) {
      const already = items.find((e) => e.colorId === '7' && /\(auto:/i.test(e.summary || ''));
      return j({ changed: false, message: already ? `Today’s session is already softened.` : 'No training session on today’s board to adjust.' });
    }
    const orig = ev.summary;
    const newSummary = readiness === 'red' ? `${orig} · EASY/REST (auto: red day)` : `${orig} · keep easy (auto: amber day)`;
    const patchUrl = `https://www.googleapis.com/calendar/v3/calendars/${cal}/events/${ev.id}`;
    const pr = await fetch(patchUrl, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary: newSummary, description: ((ev.description || '') + `\n\n[Auto-adjusted by Gideon from your check-in. Original: "${orig}". Edit this event to override.]`).trim() }),
    });
    if (!pr.ok) {
      return j({ changed: false, error: pr.status === 403 ? 'calendar access is read-only — needs write permission to auto-adjust' : ('couldn’t write (' + pr.status + ')'), needAuth: pr.status === 403 || pr.status === 401 });
    }
    return j({ changed: true, message: `Softened today’s “${orig}” to easy on your calendar.` });
  } catch (e) {
    return j({ changed: false, error: String(e) }, 500);
  }
}
