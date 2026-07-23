// GET /api/events  → next 21 days of events from the B&G calendar, mapped to the cockpit's shape.
// Uses a stored Google refresh token (env var) to mint an access token server-side.

async function googleAccessToken(env) {
  const body = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    grant_type: 'refresh_token',
    refresh_token: env.GOOGLE_REFRESH_TOKEN,
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

export async function onRequestGet({ env }) {
  try {
    const token = await googleAccessToken(env);
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
      colorId: e.colorId || '',        // peacock (7) = Brodin's; anything else is his partner's
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
