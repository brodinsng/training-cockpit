// POST /api/u/notify   Authorization: Bearer <PUSH_SECRET>
//   body { test:true, message } -> send a test push to all subscriptions
//   body {} -> detect weather change and push if changed
function j(o, s){ return new Response(JSON.stringify(o), { status: s || 200, headers: { 'content-type': 'application/json' } }); }
const enc = new TextEncoder();
function b64uToBytes(s){ s = s.split('-').join('+').split('_').join('/'); while(s.length % 4) s += '='; const bin = atob(s); const u = new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) u[i] = bin.charCodeAt(i); return u; }
function bytesToB64u(u){ let bin=''; for(let i=0;i<u.length;i++) bin += String.fromCharCode(u[i]); let b = btoa(bin).split('+').join('-').split('/').join('_'); while(b.charAt(b.length-1)==='=') b = b.slice(0,-1); return b; }
function concat(){ let len=0, i; for(i=0;i<arguments.length;i++) len += arguments[i].length; const out = new Uint8Array(len); let o=0; for(i=0;i<arguments.length;i++){ out.set(arguments[i], o); o += arguments[i].length; } return out; }
const NUL = new Uint8Array([0]);
async function importVapidKey(env){
  const pub = b64uToBytes(env.VAPID_PUBLIC);
  const jwk = { kty:'EC', crv:'P-256', x: bytesToB64u(pub.slice(1,33)), y: bytesToB64u(pub.slice(33,65)), d: env.VAPID_PRIVATE, ext:true };
  return crypto.subtle.importKey('jwk', jwk, { name:'ECDSA', namedCurve:'P-256' }, false, ['sign']);
}
async function vapidJWT(env, audience){
  const header = bytesToB64u(enc.encode(JSON.stringify({ typ:'JWT', alg:'ES256' })));
  const payload = bytesToB64u(enc.encode(JSON.stringify({ aud: audience, exp: Math.floor(Date.now()/1000) + 43200, sub: env.VAPID_SUBJECT || 'mailto:admin@example.com' })));
  const key = await importVapidKey(env);
  const sig = new Uint8Array(await crypto.subtle.sign({ name:'ECDSA', hash:'SHA-256' }, key, enc.encode(header + '.' + payload)));
  return header + '.' + payload + '.' + bytesToB64u(sig);
}
async function hkdf(salt, ikm, info, len){
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name:'HKDF', hash:'SHA-256', salt, info }, k, len * 8));
}
async function encryptPayload(sub, payloadStr){
  const uaPub = b64uToBytes(sub.keys.p256dh);
  const authSecret = b64uToBytes(sub.keys.auth);
  const asKeys = await crypto.subtle.generateKey({ name:'ECDH', namedCurve:'P-256' }, true, ['deriveBits']);
  const asPubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', asKeys.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPub, { name:'ECDH', namedCurve:'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name:'ECDH', public: uaKey }, asKeys.privateKey, 256));
  const ikm = await hkdf(authSecret, shared, concat(enc.encode('WebPush: info'), NUL, uaPub, asPubRaw), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, concat(enc.encode('Content-Encoding: aes128gcm'), NUL), 16);
  const nonce = await hkdf(salt, ikm, concat(enc.encode('Content-Encoding: nonce'), NUL), 12);
  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name:'AES-GCM', iv: nonce }, aesKey, concat(enc.encode(payloadStr), new Uint8Array([2]))));
  return concat(salt, new Uint8Array([0,0,16,0]), new Uint8Array([asPubRaw.length]), asPubRaw, ct);
}
async function sendPush(env, sub, payloadStr){
  const audience = new URL(sub.endpoint).origin;
  const jwt = await vapidJWT(env, audience);
  const body = await encryptPayload(sub, payloadStr);
  const res = await fetch(sub.endpoint, { method:'POST', headers: { 'Authorization': 'vapid t=' + jwt + ', k=' + env.VAPID_PUBLIC, 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', 'TTL': '86400' }, body });
  return res.status;
}
async function allSubs(env){
  const out = []; let cursor;
  do {
    const list = await env.PUSH.list({ prefix:'sub:', cursor });
    for(const k of list.keys){ const v = await env.PUSH.get(k.name); if(v){ try{ out.push({ name: k.name, rec: JSON.parse(v) }); }catch(e){} } }
    cursor = list.list_complete ? null : list.cursor;
  } while(cursor);
  return out;
}
async function pushToAll(env, title, body, url){
  const payload = JSON.stringify({ title, body, url: url || '/app/' });
  const subs = await allSubs(env);
  let sent = 0, gone = 0;
  for(const s of subs){
    try {
      const st = await sendPush(env, s.rec.subscription, payload);
      if(st === 201 || st === 200) sent++;
      else if(st === 404 || st === 410){ await env.PUSH.delete(s.name); gone++; }
    } catch(e){}
  }
  return { sent, gone, total: subs.length };
}
async function weatherSig(env){
  const subs = await allSubs(env);
  let geo = null;
  for(const s of subs){ if(s.rec.lat != null && s.rec.lon != null){ geo = s.rec; break; } }
  if(!geo) return null;
  const u = 'https://api.open-meteo.com/v1/forecast?latitude=' + geo.lat + '&longitude=' + geo.lon + '&current=temperature_2m,weather_code,precipitation&timezone=auto';
  const r = await fetch(u); if(!r.ok) return null; const d = await r.json(); const c = d.current || {};
  return { sig: c.weather_code + '|' + Math.round(c.temperature_2m) + '|' + (c.precipitation > 0 ? 'rain' : 'dry'), temp: Math.round(c.temperature_2m), precip: c.precipitation };
}
export async function onRequestPost({ request, env }){
  if(!env.PUSH_SECRET || (request.headers.get('authorization') || '') !== 'Bearer ' + env.PUSH_SECRET) return j({ error:'unauthorized' }, 401);
  if(!env.PUSH) return j({ error:'no_store' }, 500);
  let body = {}; try { body = await request.json(); } catch(e){}
  if(body.test){ const r = await pushToAll(env, 'Cyprus', body.message || 'Notifications are on. You are all set.', '/app/'); return j({ ok:true, test:r }); }
  const out = {};
  const w = await weatherSig(env);
  if(w){
    const last = await env.PUSH.get('sig:weather');
    if(last !== w.sig){
      await env.PUSH.put('sig:weather', w.sig);
      out.weather = (last == null) ? 'baseline set' : await pushToAll(env, 'Weather update', w.temp + 'C now' + (w.precip > 0 ? ', rain around' : '') + ' - check your session.', '/app/');
    } else out.weather = 'no change';
  } else out.weather = 'no location yet';
  return j({ ok:true, ...out });
}
