// GET /api/auth/google/login  → send the user to Google to authorize read-only Calendar access.
export async function onRequestGet({ request, env }) {
  const origin = new URL(request.url).origin;
  const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  u.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
  u.searchParams.set('redirect_uri', origin + '/api/auth/google/callback');
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('access_type', 'offline');
  u.searchParams.set('prompt', 'consent');
  u.searchParams.set('scope', 'https://www.googleapis.com/auth/calendar.readonly');
  return Response.redirect(u.toString(), 302);
}
