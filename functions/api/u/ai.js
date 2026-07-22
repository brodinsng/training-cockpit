// POST /api/u/ai  → personal AI coach reply, powered by Cloudflare Workers AI (free, no API key).
// Body: { message, context, history[] }.  context = the caller's own cockpit summary.
// Requires the "AI" binding to be enabled on the Pages project (Settings → Functions → AI bindings).
export async function onRequestPost({ request, env }) {
  try {
    if (!env.AI) {
      return new Response(JSON.stringify({ error: 'ai_unconfigured', reply: "AI isn't switched on yet — the Workers AI binding needs enabling in Cloudflare." }), {
        status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      });
    }
    const body = await request.json().catch(() => ({}));
    const message = String(body.message || '').slice(0, 2000);
    if (!message) return new Response(JSON.stringify({ error: 'empty' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    const ctx = JSON.stringify(body.context || {}).slice(0, 4000);
    const history = Array.isArray(body.history) ? body.history.slice(-6) : [];

    const system =
      "You are the user's personal endurance-training coach, living inside their 'Training Cockpit' app. " +
      "Be concise, warm, practical and specific. Use their live data below to tailor everything to THEM — " +
      "reference their actual numbers. When they tell you goals, constraints, or preferences (e.g. which sports " +
      "they care about, how many days they train, what to hide), acknowledge it plainly and restate it so it can be saved. " +
      "Never invent numbers that aren't in the data. Keep replies to 2–5 short sentences.\n\nTHEIR LIVE DATA:\n" + ctx;

    const messages = [{ role: 'system', content: system }];
    for (const h of history) {
      if (h && h.role && h.content) messages.push({ role: h.role === 'user' ? 'user' : 'assistant', content: String(h.content).slice(0, 1500) });
    }
    messages.push({ role: 'user', content: message });

    // Try current models in order; fall through if one is deprecated/unavailable.
    var MODELS = ['@cf/meta/llama-3.3-70b-instruct-fp8-fast', '@cf/meta/llama-3.1-8b-instruct-fast', '@cf/meta/llama-3.2-3b-instruct'];
    var out = null, lastErr = null;
    for (var mi = 0; mi < MODELS.length; mi++) {
      try { out = await env.AI.run(MODELS[mi], { messages, max_tokens: 512 }); if (out) break; }
      catch (err) { lastErr = err; }
    }
    if (!out) throw (lastErr || new Error('no model available'));
    const reply = (out && (out.response || out.result || (typeof out === 'string' ? out : ''))) || "I couldn't generate a reply just now — try again.";
    return new Response(JSON.stringify({ reply }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e), reply: "Something went wrong reaching the coach. Try again in a moment." }), {
      status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }
}
