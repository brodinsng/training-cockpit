// Retired. This endpoint used a single shared (owner) token and would expose the
// owner's calendar to anyone with the link. The app now uses per-user /api/u/events.
export const onRequestGet = () =>
  new Response(JSON.stringify({ error: 'gone', use: '/api/u/events' }), {
    status: 410, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
