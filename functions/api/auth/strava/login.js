// GET /api/auth/strava/login  → send the user to Strava to authorize their OWN account.
export async function onRequestGet({ request, env }) {
  const origin = new URL(request.url).origin;
  const u = new URL('https://www.strava.com/oauth/authorize');
  u.searchParams.set('client_id', env.STRAVA_CLIENT_ID);
  u.searchParams.set('redirect_uri', origin + '/api/auth/strava/callback');
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('approval_prompt', 'auto');
  u.searchParams.set('scope', 'read,activity:read_all');
  return Response.redirect(u.toString(), 302);
}
