// GET /api/auth/strava/callback  → exchanges the code for tokens and shows the refresh token to paste into env.
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  if (!code) return new Response('Missing code', { status: 400 });
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
  const rt = d.refresh_token || '(none returned) ' + JSON.stringify(d);
  return new Response(
    `<!doctype html><meta name=viewport content="width=device-width,initial-scale=1">
     <body style="font-family:system-ui;max-width:640px;margin:40px auto;padding:0 16px">
     <h2>Strava connected ✓</h2>
     <p>Copy this value into your Cloudflare Pages env var <b>STRAVA_REFRESH_TOKEN</b>, then redeploy:</p>
     <pre style="padding:14px;background:#eef2f6;border-radius:8px;white-space:pre-wrap;word-break:break-all">${rt}</pre>
     <p style="color:#5f7585">You can close this tab afterwards.</p></body>`,
    { headers: { 'Content-Type': 'text/html' } }
  );
}
