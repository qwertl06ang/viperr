const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const encode = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const digest = async text => encode(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))));
const randomToken = () => encode(crypto.getRandomValues(new Uint8Array(32)));
const headers = {'Cache-Control':'no-store', 'Referrer-Policy':'no-referrer', 'X-Content-Type-Options':'nosniff'};
const json = (data, status=200) => Response.json(data, {status, headers});
const redirect = url => new Response(null, {status:302, headers:{...headers, Location:url}});

export async function bridgeIdentity(request, env) {
  const authorization = request.headers.get('authorization');
  if (!authorization) return request.headers.get('oai-authenticated-user-id');
  const token = authorization.replace(/^Bearer /, '');
  if (!authorization.startsWith('Bearer ') || !tokenPattern.test(token)) return null;
  const row = await env.DB.prepare('SELECT user_id FROM bridge_sessions WHERE token_hash = ? AND expires_at > ?').bind(await digest(token), Date.now()).first();
  return row?.user_id || null;
}

export async function handleBridge(request, env) {
  const url = new URL(request.url), now = Date.now();
  if (!env.DB || !env.VIPERR_PUBLIC_ORIGIN) return json({error:'The sign-in connection is unavailable.'},503);
  const canonical = new URL(env.VIPERR_PUBLIC_ORIGIN);
  if (canonical.protocol !== 'https:' || canonical.pathname !== '/' || canonical.search || canonical.hash) return json({error:'Invalid sign-in configuration.'},503);
  const callback = canonical.origin + '/api/auth/callback';
  if (url.pathname === '/auth/bridge' && request.method === 'GET') {
    const state = url.searchParams.get('state'), challenge = url.searchParams.get('code_challenge');
    if (!tokenPattern.test(state || '') || !tokenPattern.test(challenge || '') || url.searchParams.get('code_challenge_method') !== 'S256') return json({error:'Start sign-in from VIPERR.'},400);
    // Only the Sites platform may supply the native identity at this endpoint.
    const user = request.headers.get('oai-authenticated-user-id');
    if (!user) return redirect('/signin-with-chatgpt?return_to='+encodeURIComponent(url.pathname+url.search));
    await env.DB.prepare('DELETE FROM bridge_codes WHERE code_hash IN (SELECT code_hash FROM bridge_codes WHERE expires_at <= ? LIMIT 200)').bind(now).run();
    await env.DB.prepare('DELETE FROM bridge_sessions WHERE token_hash IN (SELECT token_hash FROM bridge_sessions WHERE expires_at <= ? LIMIT 200)').bind(now).run();
    const code = randomToken();
    const result = await env.DB.prepare('INSERT INTO bridge_codes (code_hash, user_id, state_hash, challenge, audience, expires_at) SELECT ?, ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM bridge_codes WHERE user_id = ?) < 10').bind(await digest(code), user, await digest(state), challenge, callback, now+300000, user).run();
    if (!result.meta.changes) return json({error:'Please wait a few minutes before signing in again.'},429);
    const target = new URL(callback); target.searchParams.set('code',code); target.searchParams.set('state',state);
    return redirect(target.href);
  }
  if (url.pathname === '/api/auth/exchange' && request.method === 'POST') {
    if (!request.headers.get('content-type')?.includes('application/json')) return json({error:'Send JSON.'},415);
    const reader=request.body?.getReader(); let size=0, body=''; const decoder=new TextDecoder();
    if(!reader)return json({error:'Missing request.'},400);
    while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>2048){await reader.cancel();return json({error:'Request too large.'},413);}body+=decoder.decode(part.value,{stream:true});}
    let input;try{input=JSON.parse(body+decoder.decode());}catch{return json({error:'Invalid request.'},400);}
    const {code,state,verifier,redirect_uri}=input || {};
    if (![code,state,verifier].every(v=>typeof v==='string'&&tokenPattern.test(v)) || redirect_uri!==callback) return json({error:'Invalid sign-in request.'},400);
    const row=await env.DB.prepare('DELETE FROM bridge_codes WHERE code_hash = ? AND state_hash = ? AND challenge = ? AND audience = ? AND expires_at > ? RETURNING user_id').bind(await digest(code), await digest(state), await digest(verifier), callback, now).first();
    if(!row)return json({error:'This sign-in link expired. Please sign in again.'},401);
    const token=randomToken(),expiresAt=now+30*24*60*60*1000;
    const result=await env.DB.prepare('INSERT INTO bridge_sessions (token_hash,user_id,expires_at) SELECT ?, ?, ? WHERE (SELECT COUNT(*) FROM bridge_sessions WHERE user_id = ? AND expires_at > ?) < 30').bind(await digest(token),row.user_id,expiresAt,row.user_id,now).run();
    if(!result.meta.changes)return json({error:'Sign-in limit reached. Use an existing session.'},429);
    return json({token,expiresAt});
  }
  if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
    const token=request.headers.get('authorization')?.replace(/^Bearer /,'');
    if(tokenPattern.test(token || ''))await env.DB.prepare('DELETE FROM bridge_sessions WHERE token_hash = ?').bind(await digest(token)).run();
    return json({signedOut:true});
  }
  return json({error:'This sign-in action is unavailable.'},405);
}
