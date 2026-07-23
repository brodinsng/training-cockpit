// POST /api/coach  → Cyprus AI: generative coaching via Cloudflare Workers AI.
// Requires the Workers AI binding named "AI" (Cloudflare Pages → Settings → Functions → AI binding).
// Falls back gracefully (frontend keeps the rule-based coach) when the binding is absent.

function j(o, s) {
  return new Response(JSON.stringify(o), { status: s || 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

export async function onRequestPost({ request, env }) {
  if (!env.AI) return j({ available: false, note: 'Workers AI binding "AI" not configured yet.' });
  try {
    const d = await request.json();
    const sys = [
      'You are Cyprus, a dry-witted, honest triathlon coach-assistant (JARVIS-style). Address the athlete as "sir".',
      'From the JSON training data, give exactly 3 short, specific, actionable coaching tips for today and this week.',
      'Data keys: fitness=CTL(42d), fatigue=ATL(7d), form=TSB (negative=tired), last7 by discipline, checkin (1-5 scales: legs/sleep/sore/head/mot — how he FEELS; low scores override the model), today = today\'s planned session.',
      'Context: A-race TriFactor Long 13 Sep 2026 (2.25k swim/42k bike/15k run). Strengths-first policy: he builds bike+run, swim is maintenance-only — NEVER nag about swim volume.',
      'Fixed anchors: Wed FIVE45 bike intensity, Sun CCP ride, Tuesday rest. If check-in is low (avg <= 2.5), recovery beats any planned session.',
      'Each tip 1-2 sentences, plain text, one per line, no numbering, no markdown, no preamble.',
    ].join(' ');
    const r = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: JSON.stringify(d) },
      ],
      max_tokens: 320,
    });
    const text = ((r && (r.response || r.result)) || '').trim();
    if (!text) return j({ available: false, note: 'empty response' });
    return j({ available: true, text });
  } catch (e) {
    return j({ available: false, error: String(e) });
  }
}
