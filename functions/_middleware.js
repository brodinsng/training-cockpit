// Site-wide password gate (HTTP Basic Auth). Runs on every request to the project.
// Set env var APP_PASSWORD in Cloudflare to activate. Any username works; only the password is checked.
// If APP_PASSWORD is not set, the site stays open (so you can't lock yourself out before configuring it).
export async function onRequest(context) {
  const { request, env, next } = context;
  const expected = env.APP_PASSWORD;
  if (!expected) return next(); // not configured yet → don't lock

  const header = request.headers.get('Authorization') || '';
  if (header.startsWith('Basic ')) {
    try {
      const decoded = atob(header.slice(6));
      const sep = decoded.indexOf(':');
      const password = sep >= 0 ? decoded.slice(sep + 1) : decoded;
      if (password === expected) return next();
    } catch (_) { /* fall through to 401 */ }
  }

  return new Response('Authentication required.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Training Cockpit", charset="UTF-8"',
      'Content-Type': 'text/plain',
    },
  });
}
