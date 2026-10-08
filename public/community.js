'use strict';
let listenerVote=null, sharedPlaylist=null, shareAttempt=null;
const signOut=document.createElement('button');signOut.type='button';signOut.className='text-button';signOut.textContent='Sign out of VIPERR';signOut.hidden=true;document.querySelector('#saved-dialog').append(signOut);
signOut.addEventListener('click',async()=>{signOut.disabled=true;try{await archiveRequest('/api/auth/logout',{method:'POST',body:'{}'});location.reload();}catch(error){toast(error.message);signOut.disabled=false;}});
const voteSelect=document.querySelector('#vote-album'),voteStatus=document.querySelector('#vote-status');
voteSelect.insertAdjacentHTML('beforeend',albums.map(a=>`<option value="${esc(a.id)}">${esc(a.artist)} — ${esc(a.title)}</option>`).join(''));
function renderSignal(data){
  if('authenticated' in data)signOut.hidden=!(data.authenticated&&data.signOutPath);
  listenerVote=data.vote;voteSelect.value=listenerVote||'';
  const total=data.stats.reduce((sum,row)=>sum+row.votes,0);
  document.querySelector('#vote-total').textContent=total;document.querySelector('#playlist-total').textContent=data.playlistCount;
  const ranking=data.stats.filter(row=>byId.has(row.albumId)).sort((a,b)=>b.votes-a.votes||a.albumId.localeCompare(b.albumId)).slice(0,5);
  document.querySelector('#vote-ranking').innerHTML=ranking.length?ranking.map((row,i)=>{const a=byId.get(row.albumId);return `<button class="rank-row" data-release="${esc(a.id)}"><span class="rank-index">0${i+1}</span><img src="${esc(a.cover)}" width="56" height="56" alt=""><span class="rank-name"><strong>${esc(a.title)}</strong><small>${esc(a.artist)}</small><i style="--share:${Math.round(row.votes/total*100)}%"></i></span><span>${row.votes}<small>${row.votes===1?'PICK':'PICKS'}</small></span></button>`}).join(''):'<div class="no-signal"><span>∅</span><p>No picks yet.<br>Be the first to send a signal.</p></div>';
  voteStatus.textContent=listenerVote?`Your pick: ${byId.get(listenerVote)?.title}. You can change it any time.`:'Choose a record to make the first connection.';
  window.ScrollTrigger?.refresh();
}
async function connectArchive(){
  const retry=document.querySelector('#retry-connection');retry.disabled=true;voteStatus.textContent='Connecting to the archive…';
  try{const state=await archiveRequest('/api/state');saved=state.saved;libraryReady=state.authenticated;archiveConnected=true;renderSignal(state);voteSelect.disabled=!libraryReady;document.querySelector('#cast-vote').disabled=!libraryReady;document.querySelector('#save-shared').disabled=!libraryReady||!sharedPlaylist;retry.hidden=true;document.querySelectorAll('[data-sign-in]').forEach(link=>{link.hidden=libraryReady;link.href=(state.signInPath||'/signin-with-chatgpt')+'?return_to='+encodeURIComponent(location.pathname+location.search+location.hash);});if(!libraryReady)voteStatus.textContent='Explore the archive freely. Sign in to save your library and send a signal.';}
  catch(error){libraryReady=false;archiveConnected=false;voteSelect.disabled=true;document.querySelector('#cast-vote').disabled=true;voteStatus.textContent=error.message;retry.hidden=false;document.querySelector('#vote-ranking').innerHTML='<p class="small-note">The community signal is unavailable. Try reconnecting.</p>';}
  finally{retry.disabled=false;updateSaved();}
}
document.querySelector('#retry-connection').addEventListener('click',connectArchive);
document.querySelector('#vote-form').addEventListener('submit',async event=>{event.preventDefault();const albumId=voteSelect.value;if(!albumId)return;const button=document.querySelector('#cast-vote');button.disabled=true;voteSelect.disabled=true;voteStatus.textContent='Sending your signal…';try{renderSignal(await archiveRequest('/api/vote',{method:'POST',body:JSON.stringify({albumId})}));toast('Your signal is saved');}catch(error){voteStatus.textContent=error.message;}finally{button.disabled=!libraryReady;voteSelect.disabled=!libraryReady;}});
document.querySelector('#share-form').addEventListener('submit',async event=>{event.preventDefault();if(!saved.length)return;const button=document.querySelector('#create-playlist'),status=document.querySelector('#library-status'),title=document.querySelector('#playlist-title').value.trim();if(!title)return;
  const signature=JSON.stringify({title,ids:saved});if(shareAttempt?.signature!==signature)shareAttempt={signature,id:crypto.randomUUID()};
  const payload={id:shareAttempt.id,title,ids:[...saved]};button.disabled=true;status.textContent='Creating your playlist link…';
  try{const playlist=await archiveRequest('/api/playlists',{method:'POST',body:JSON.stringify(payload)});const url=new URL(location.href);url.search='';url.hash='';url.searchParams.set('playlist',playlist.id);document.querySelector('#share-url').value=url.href;document.querySelector('#share-result').hidden=false;status.textContent='Your playlist is saved. Copy the link to share it.';toast('Playlist link created');}
  catch(error){status.textContent=error.message;}finally{button.disabled=!saved.length||!libraryReady;}
});
document.querySelector('#copy-playlist').addEventListener('click',async()=>{const input=document.querySelector('#share-url');try{await navigator.clipboard.writeText(input.value);toast('Playlist link copied');}catch{input.focus();input.select();toast('Select and copy your playlist link');}});
async function loadSharedPlaylist(id){
  const dialog=document.querySelector('#playlist-dialog');showDialog(dialog);document.querySelector('#shared-meta').textContent='Loading this frequency…';
  try{sharedPlaylist=await archiveRequest('/api/playlists/'+encodeURIComponent(id));document.querySelector('#shared-title').textContent=sharedPlaylist.title;document.querySelector('#shared-meta').textContent=`${sharedPlaylist.ids.length} ${sharedPlaylist.ids.length===1?'release':'releases'} / A listener’s saved frequency`;
    document.querySelector('#shared-releases').innerHTML=sharedPlaylist.ids.map(id=>{const a=byId.get(id);return `<button class="shared-record" data-release="${esc(id)}"><img src="${esc(a.cover)}" alt="" width="64" height="64"><span><strong>${esc(a.title)}</strong><small>${esc(a.artist)}</small></span><span>↗</span></button>`}).join('');document.querySelector('#save-shared').disabled=!libraryReady;
  }catch(error){document.querySelector('#shared-meta').textContent=error.message;}
}
document.querySelector('#save-shared').addEventListener('click',async()=>{if(!sharedPlaylist)return;const button=document.querySelector('#save-shared'),status=document.querySelector('#shared-status');button.disabled=true;try{await changeSaved(sharedPlaylist.ids);status.textContent='These releases are now in your saved library.';toast('Playlist added to your library');}catch(error){status.textContent=error.message;}finally{button.disabled=!libraryReady;}});
connectArchive().then(()=>{const id=new URL(location.href).searchParams.get('playlist');if(id)loadSharedPlaylist(id);});
