import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';

const backend='https://viperr-archive.adilzhanaliakbar.chatgpt.site';
const tokenPattern=/^[A-Za-z0-9_-]{43}$/;
const sessionName='__Host-viperr-session', flowName='__Host-viperr-flow';
const noStore={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
const cookie=(name,value,age)=>`${name}=${value}; Path=/; Max-Age=${age}; Secure; HttpOnly; SameSite=Lax`;
const random=()=>randomBytes(32).toString('base64url');
const digest=s=>createHash('sha256').update(s).digest('base64url');
const cookies=request=>{const jar={};for(const pair of(request.headers.get('cookie')||'').split(';')){const [name,value]=pair.trim().split(/=(.*)/s);if(name in jar)throw new Error('Duplicate cookie');jar[name]=value;}return jar;};
const failure=(message,status=400)=>Response.json({error:message},{status,headers:noStore});
const redirect=(url,setCookie)=>new Response(null,{status:302,headers:{...noStore,Location:url,...(setCookie?{'Set-Cookie':setCookie}:{})}});
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const safeReturn=value=>{try{const u=new URL(value||'/','https://viperr.invalid');return u.origin==='https://viperr.invalid'?u.pathname+u.search+u.hash:'/';}catch{return '/';}};

// Only the selected production origin is accepted; preview URLs never mint sessions.
export function createGateway({origin=process.env.VIPERR_PUBLIC_ORIGIN, fetchUpstream=fetch}={}) {
 return async function handle(request) {
  try {
    if(!origin || new URL(origin).protocol!=='https:')return failure('The archive connection is being configured.',503);
    const canonical=new URL(origin).origin,url=new URL(request.url);
    const route=url.pathname==='/api/gateway'?'/api/'+(url.searchParams.get('route')||''):url.pathname;
    if(url.origin!==canonical)return failure('Open VIPERR at '+canonical+'.',403);
    const jar=cookies(request),callback=canonical+'/api/auth/callback';
    for(const key of ['code','state','route','return_to'])if(url.searchParams.getAll(key).length>1)return failure('Invalid request.');
    if(request.method!=='GET'&&request.method!=='HEAD'){
      if(request.headers.get('origin')!==canonical||request.headers.get('sec-fetch-site')==='cross-site')return failure('Open this action from the VIPERR site.',403);
    }
    const send=async(path,options={})=>fetchUpstream(backend+path,{...options,redirect:'manual',signal:AbortSignal.timeout(15000)});
    if(route==='/api/auth/start'&&request.method==='GET'){
      const state=random(),verifier=random(),flow=Buffer.from(JSON.stringify({state,verifier,returnTo:safeReturn(url.searchParams.get('return_to')),expires:Date.now()+600000})).toString('base64url');
      const target=new URL(backend+'/auth/bridge');target.searchParams.set('state',state);target.searchParams.set('code_challenge',digest(verifier));target.searchParams.set('code_challenge_method','S256');
      return redirect(target.href,cookie(flowName,flow,600));
    }
    if(route==='/api/auth/callback'&&request.method==='GET'){
      let flow;try{flow=JSON.parse(Buffer.from(jar[flowName]||'','base64url').toString());}catch{return failure('Start sign-in again from VIPERR.',401);}
      const code=url.searchParams.get('code'),state=url.searchParams.get('state');
      if(!flow||!Number.isFinite(flow.expires)||flow.expires<Date.now()||!tokenPattern.test(code||'')||!tokenPattern.test(state||'')||!tokenPattern.test(flow.verifier||'')||!equal(state,flow.state))return failure('This sign-in link expired. Start again from VIPERR.',401);
      const response=await send('/api/auth/exchange',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,state,verifier:flow.verifier,redirect_uri:callback})});
      if(!response.ok)return failure('Sign-in could not be completed. Please try again.',401);
      const result=await response.json();if(!tokenPattern.test(result.token||''))return failure('Invalid sign-in response.',502);
      const age=Math.max(0,Math.min(2592000,Math.floor((result.expiresAt-Date.now())/1000)));
      if(!age)return failure('This sign-in link expired.',401);
      const responseHeaders=new Headers({...noStore,Location:canonical+safeReturn(flow.returnTo)});
      responseHeaders.append('Set-Cookie',cookie(sessionName,result.token,age));responseHeaders.append('Set-Cookie',cookie(flowName,'',0));
      return new Response(null,{status:302,headers:responseHeaders});
    }
    const allowed=/^\/api\/(state|saved|vote|playlists(?:\/[0-9a-f-]{36})?|auth\/logout)$/i;
    if(!allowed.test(route))return failure('This archive action does not exist.',404);
    const headers={'Content-Type':'application/json'};
    if(tokenPattern.test(jar[sessionName]||''))headers.Authorization='Bearer '+jar[sessionName];
    let body;
    if(request.method!=='GET'&&request.method!=='HEAD'){
      if(!request.headers.get('content-type')?.includes('application/json'))return failure('Send a JSON request.',415);
      const reader=request.body?.getReader();let count=0;const parts=[];
      if(reader)while(true){const chunk=await reader.read();if(chunk.done)break;count+=chunk.value.length;if(count>8192){await reader.cancel();return failure('Request is too large.',413);}parts.push(Buffer.from(chunk.value));}
      body=Buffer.concat(parts);
    }
    // Construct fresh headers: browser identity headers and cookies never reach Sites.
    const upstream=await send(route,{method:request.method,headers,...(body?{body}:{})});
    if(!upstream.headers.get('content-type')?.includes('application/json'))return failure('The archive connection is unavailable. Please try again.',503);
    const data=await upstream.json();
    if(route==='/api/state'){data.signInPath='/api/auth/start';data.signOutPath='/api/auth/logout';}
    return Response.json(data,{status:upstream.status,headers:{...noStore,...(route==='/api/auth/logout'?{'Set-Cookie':cookie(sessionName,'',0)}:{})}});
  }catch{return failure('The archive connection is unavailable. Please try again.',503);}
 };
}
export default {fetch:request=>createGateway()(request)};
