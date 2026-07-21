// GET /api/events → next 21 days of events from the B&G calendar, mapped to the cockpit's shape.
// Prefers the per-browser Google refresh token stored in the `g_rt` cookie (set by the
// OAuth connect flow); falls back to the GOOGLE_REFRESH_TOKEN env var for compatibility.

function cookie(request, name) {
  const c = request.headers.get('Cookie') || '';
  const m = c.match(new RegExp('(?:^|; )' + name + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : '';
}

async function googleAccessToken(env, refreshToken) {
  const body = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const d = await res.json();
  if (!d.access_token) throw new Error('google token: ' + JSON.stringify(d));
  return d.access_token;
}

export async function onRequestGet({ request, env }) {
  try {
    const refreshToken = cookie(request, 'g_rt') || env.GOOGLE_REFRESH_TOKEN;
    if (!refreshToken) {
      return new Response(JSON.stringify({ error: 'google not connected' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      });
    }
    const token = await googleAccessToken(env, refreshToken);
    const now = new Date();
    const end = new Date(now.getTime() + 21 * 864e5);
    const cal = encodeURIComponent(env.CAL_ID);
    const url =
      `https://www.googleapis.com/calendar/v3/calendars/${cal}/events` +
      `?timeMin=${now.toISOString()}&timeMax=${end.toISOString()}` +
      `&singleEvents=true&orderBy=startTime&maxResults=250`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      return new Response(JSON.stringify({ error: 'google', status: res.status }), {
        status: 502, headers: { 'Content-Type': 'application/json' },
      });
    }
    const raw = await res.json();
    const events = (raw.items || []).map((e) => ({
      id: e.id,
      summary: e.summary || '',
      description: e.description || '',
      start: e.start,
      end: e.end,
      colorId: e.colorId || '', // peacock (7) = Brodin's; anything else is his partner's
      creatorEmail: (e.creator && e.creator.email) || '',
    }));
    return new Response(JSON.stringify({ events }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
