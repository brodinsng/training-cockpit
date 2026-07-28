// GET /api/auth/strava  → kicks off Strava OAuth. Visit once to authorise.
// Optional ?return=/path sends the user back there after auth (defaults to /app/).
export function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const redirect = `${url.origin}/api/auth/strava/callback`;
  const ret = url.searchParams.get('return');
  const state = (ret && ret.startsWith('/') && !ret.startsWith('//')) ? ret : '';
  const auth =
    `https://www.strava.com/oauth/authorize?client_id=${env.STRAVA_CLIENT_ID}` +
    `&response_type=code&redirect_uri=${encodeURIComponent(redirect)}` +
    `&approval_prompt=force&scope=activity:read_all` +
    (state ? `&state=${encodeURIComponent(state)}` : '');
  return Response.redirect(auth, 302);
}
