// GET /api/me  → which services this browser has connected (reads the httpOnly cookies).
function has(req, name) {
  const c = req.headers.get('Cookie') || '';
  return new RegExp('(?:^|; )' + name + '=').test(c);
}
export async function onRequestGet({ request }) {
  return new Response(
    JSON.stringify({ strava: has(request, 's_rt'), google: has(request, 'g_rt') }),
    { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }
  );
}
