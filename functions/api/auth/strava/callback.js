// GET /api/auth/strava/callback  → exchange the code for the user's refresh token, store it in a cookie.
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const dest = (state && state.startsWith('/') && !state.startsWith('//')) ? state : '/app/';
  if (!code) return Response.redirect(origin + dest + (dest.indexOf('?')>-1?'&':'?') + 'err=strava', 302);
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.STRAVA_CLIENT_ID,
      client_secret: env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    }),
  });
  const d = await res.json();
  if (!d.refresh_token) return Response.redirect(origin + dest + (dest.indexOf('?')>-1?'&':'?') + 'err=strava_token', 302);
  const headers = new Headers();
  headers.append('Set-Cookie', `s_rt=${encodeURIComponent(d.refresh_token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=34560000`);
  headers.append('Location', origin + dest);
  return new Response(null, { status: 302, headers });
}
