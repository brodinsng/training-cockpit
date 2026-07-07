// GET /api/logout  → clear the stored tokens.
export async function onRequestGet({ request }) {
  const origin = new URL(request.url).origin;
  const h = new Headers();
  h.append('Set-Cookie', 's_rt=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
  h.append('Set-Cookie', 'g_rt=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
  h.append('Location', origin + '/app/');
  return new Response(null, { status: 302, headers: h });
}
