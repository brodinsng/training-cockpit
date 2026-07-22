// GET /api/u/setcal?id=<calendarId>  → remembers which calendar this user's cockpit reads.
// Stores the choice in a long-lived cookie so it persists without re-logging-in.
export function onRequestGet({ request }) {
  const id = new URL(request.url).searchParams.get('id') || 'primary';
  const headers = new Headers();
  headers.append('Set-Cookie', `cal_id=${encodeURIComponent(id)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=34560000`);
  headers.append('Content-Type', 'application/json');
  headers.append('Cache-Control', 'no-store');
  return new Response(JSON.stringify({ ok: true, id }), { headers });
}
