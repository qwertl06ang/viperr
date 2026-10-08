import http from 'node:http';
import {readFile, mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import worker from '../dist/server/index.js';
import {createLocalDB} from './local-db.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)), client=path.resolve(root,'dist/client');
await mkdir(path.join(root,'.local'),{recursive:true});
const DB=createLocalDB(path.join(root,'.local/dev.sqlite'),path.join(root,'drizzle'));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2'};
const ASSETS={async fetch(request){let name;try{name=decodeURIComponent(new URL(request.url).pathname);}catch{return new Response('Bad path',{status:400});}const file=path.resolve(client,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(client+path.sep))return new Response('Not found',{status:404});try{return new Response(await readFile(file),{headers:{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}});}catch{return new Response('Not found',{status:404});}}};
const server=http.createServer(async(req,res)=>{try{
  const headers=new Headers(); for(const [key,value] of Object.entries(req.headers))if(!key.startsWith('oai-authenticated-')&&value)headers.set(key,Array.isArray(value)?value.join(','):value);
  // A development-only identity. Bind to loopback; never trust client-supplied identity headers.
  if(process.env.VIPERR_PREVIEW_ANONYMOUS!=='1')headers.set('oai-authenticated-user-id','local_preview_owner');
  const request=new Request(`http://127.0.0.1:4173${req.url}`,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:req,duplex:'half'}:{})});
  const response=await worker.fetch(request,{DB,ASSETS});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
}catch(error){console.error(error);res.writeHead(500);res.end('Local preview error');}});
server.listen(4173,'127.0.0.1',()=>console.log('VIPERR with persistent local database: http://127.0.0.1:4173'));
process.on('SIGINT',()=>server.close(()=>{DB.close();process.exit(0);}));
