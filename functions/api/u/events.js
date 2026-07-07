// GET /api/u/events  → the LOGGED-IN user's Google Calendar (primary) for the next 21 days.
function getCookie(req, name) {
  const c = req.headers.get('Cookie') || '';
  const m = c.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}
export async function onRequestGet({ request, env }) {
  const rt = getCookie(request, 'g_rt');
  if (!rt) return new Response(JSON.stringify({ error: 'not_connected', needAuth: true }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const body = new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, grant_type: 'refresh_token', refresh_token: rt });
    const tr = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    const td = await tr.json();
    if (!td.access_token) throw new Error('google token');
    const now = new Date(); const end = new Date(now.getTime() + 21 * 864e5);
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${now.toISOString()}&timeMax=${end.toISOString()}&singleEvents=true&orderBy=startTime&maxResults=250`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${td.access_token}` } });
    if (!res.ok) return new Response(JSON.stringify({ error: 'google', status: res.status }), { status: 502, headers: { 'Content-Type': 'application/json' } });
    const raw = await res.json();
    const events = (raw.items || []).map((e) => ({ id: e.id, summary: e.summary || '', description: e.description || '', start: e.start, end: e.end, colorId: e.colorId || '' }));
    return new Response(JSON.stringify({ events }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  } catch (e) { return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { 'Content-Type': 'application/json' } }); }
}
