// GET /api/auth/google  → kicks off Google OAuth (offline, forced consent so we get a refresh token).
// Optional ?return=/path sends the user back there after auth (defaults to /app/).
export function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const redirect = `${url.origin}/api/auth/google/callback`;
  const ret = url.searchParams.get('return');
  const state = (ret && ret.startsWith('/') && !ret.startsWith('//')) ? ret : '';
  const p = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirect,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    scope: 'https://www.googleapis.com/auth/calendar.events.readonly',
  });
  if (state) p.set('state', state);
  return Response.redirect('https://accounts.google.com/o/oauth2/v2/auth?' + p.toString(), 302);
}
