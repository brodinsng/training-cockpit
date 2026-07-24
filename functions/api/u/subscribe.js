// GET  /api/u/subscribe  -> { publicKey }   VAPID public key for the browser
// POST /api/u/subscribe  -> stores a PushSubscription (+ optional lat/lon) in KV
// DELETE /api/u/subscribe -> removes a subscription by endpoint
function j(o, s){ return new Response(JSON.stringify(o), { status: s || 200, headers: { 'content-type': 'application/json' } }); }
async function keyFor(endpoint){
  const data = new TextEncoder().encode(endpoint);
  const h = await crypto.subtle.digest('SHA-256', data);
  const b = [].slice.call(new Uint8Array(h)).map(function(x){ return x.toString(16).padStart(2, '0'); }).join('');
  return 'sub:' + b.slice(0, 40);
}
export async function onRequestGet({ env }){
  return j({ publicKey: env.VAPID_PUBLIC || '' });
}
export async function onRequestPost({ request, env }){
  if(!env.PUSH) return j({ error: 'no_store' }, 500);
  let body; try{ body = await request.json(); }catch(e){ return j({ error: 'bad_json' }, 400); }
  const sub = body && body.subscription;
  if(!sub || !sub.endpoint) return j({ error: 'no_subscription' }, 400);
  const rec = { subscription: sub, lat: (body.lat != null ? body.lat : null), lon: (body.lon != null ? body.lon : null), ts: Date.now() };
  await env.PUSH.put(await keyFor(sub.endpoint), JSON.stringify(rec));
  return j({ ok: true });
}
export async function onRequestDelete({ request, env }){
  if(!env.PUSH) return j({ error: 'no_store' }, 500);
  let body; try{ body = await request.json(); }catch(e){ return j({ error: 'bad_json' }, 400); }
  const ep = body && body.endpoint;
  if(!ep) return j({ error: 'no_endpoint' }, 400);
  await env.PUSH.delete(await keyFor(ep));
  return j({ ok: true });
}
