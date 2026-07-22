// GET /api/auth/google  → kicks off Google OAuth (offline, forced consent so we get a refresh token).
// Scope calendar.readonly lets us both LIST the user's calendars (for the picker) and READ events.
export function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const redirect = `${url.origin}/api/auth/google/callback`;
  const p = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirect,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    scope: 'https://www.googleapis.com/auth/calendar.readonly',
  });
  return Response.redirect('https://accounts.google.com/o/oauth2/v2/auth?' + p.toString(), 302);
}
