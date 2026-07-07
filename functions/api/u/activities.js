// GET /api/u/activities  → the LOGGED-IN user's Strava activities (uses their cookie refresh token).
function getCookie(req, name) {
  const c = req.headers.get('Cookie') || '';
  const m = c.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}
export async function onRequestGet({ request, env }) {
  const rt = getCookie(request, 's_rt');
  if (!rt) return new Response(JSON.stringify({ error: 'not_connected', needAuth: true }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const tr = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: env.STRAVA_CLIENT_ID, client_secret: env.STRAVA_CLIENT_SECRET, grant_type: 'refresh_token', refresh_token: rt }),
    });
    const td = await tr.json();
    if (!td.access_token) throw new Error('strava token');
    const res = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=100', { headers: { Authorization: `Bearer ${td.access_token}` } });
    if (!res.ok) return new Response(JSON.stringify({ error: 'strava', status: res.status }), { status: 502, headers: { 'Content-Type': 'application/json' } });
    const raw = await res.json();
    const activities = (Array.isArray(raw) ? raw : []).map((a) => ({
      id: String(a.id), name: a.name, sport_type: a.sport_type || a.type,
      start_local: (a.start_date_local || '').replace('Z', ''),
      summary: { distance: a.distance, moving_time: a.moving_time, elapsed_time: a.elapsed_time, elevation_gain: a.total_elevation_gain, relative_effort: a.suffer_score ?? 0, total_calories: a.calories, pr_count: a.pr_count ?? 0, achievement_count: a.achievement_count ?? 0 },
    }));
    return new Response(JSON.stringify({ activities }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  } catch (e) { return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { 'Content-Type': 'application/json' } }); }
}
