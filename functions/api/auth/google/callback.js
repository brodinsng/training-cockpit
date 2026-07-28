// GET /api/auth/google/callback  → exchange the code for the user's refresh token, store it in a cookie.
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const dest = (state && state.startsWith('/') && !state.startsWith('//')) ? state : '/app/';
  if (!code) return Response.redirect(origin + dest + (dest.indexOf('?')>-1?'&':'?') + 'err=google', 302);
  const body = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    code,
    grant_type: 'authorization_code',
    redirect_uri: origin + '/api/auth/google/callback',
  });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const d = await res.json();
  if (!d.refresh_token) return Response.redirect(origin + dest + (dest.indexOf('?')>-1?'&':'?') + 'err=google_token', 302);
  const headers = new Headers();
  headers.append('Set-Cookie', `g_rt=${encodeURIComponent(d.refresh_token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=34560000`);
  headers.append('Location', origin + dest);
  return new Response(null, { status: 302, headers });
}
