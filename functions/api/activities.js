// Retired. This endpoint used a single shared (owner) token and would expose the
// owner's Strava to anyone with the link. The app now uses per-user /api/u/activities.
export const onRequestGet = () =>
  new Response(JSON.stringify({ error: 'gone', use: '/api/u/activities' }), {
    status: 410, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
