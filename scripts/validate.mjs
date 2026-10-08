import {readFile,access} from 'node:fs/promises';
import assert from 'node:assert/strict';
const html=await readFile('dist/client/index.html','utf8');
const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
for(const [,ref] of html.matchAll(/(?:src|href)="([^"]+)"/g)){
 if(ref.startsWith('#')&&ref.length>1)assert(ids.has(ref.slice(1)),`Missing anchor ${ref}`);
 else if(!ref.startsWith('#')&&!ref.startsWith('/signin-with-chatgpt')&&!/^(https?:|data:)/.test(ref))await access('dist/client/'+ref);
}
assert(html.includes('lang="en"'));assert(!/[А-Яа-яЁё]/.test(html));
const catalog=JSON.parse(await readFile('viperr-catalog.json','utf8'));
for(const album of catalog){await access('dist/client/'+album.cover);for(const platform of ['spotify','youtubeMusic','deezer','tidal'])assert(album.platforms.some(p=>p.platform===platform));assert(album.platforms.every(p=>new URL(p.url).protocol==='https:'));}
for(const file of ['app.js','community.js'])assert(!/[А-Яа-яЁё]/.test(await readFile('dist/client/'+file,'utf8')));
await access('dist/server/index.js');await access('drizzle/0000_fast_anthem.sql');
console.log(`Verified English UI, local assets, section anchors and platform links for ${catalog.length} releases.`);
