// GET /api/u/calendars  → the logged-in user's calendar list (for the calendar picker).
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
    const res = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=250&minAccessRole=reader', { headers: { Authorization: `Bearer ${td.access_token}` } });
    if (!res.ok) return new Response(JSON.stringify({ error: 'google', status: res.status }), { status: 502, headers: { 'Content-Type': 'application/json' } });
    const raw = await res.json();
    const current = getCookie(request, 'cal_id') || 'primary';
    const calendars = (raw.items || []).map((c) => ({ id: c.id, summary: c.summary || c.id, primary: !!c.primary }));
    return new Response(JSON.stringify({ calendars, current }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  } catch (e) { return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { 'Content-Type': 'application/json' } }); }
}
