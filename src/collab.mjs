import {searchCatalog,normalize} from "./catalog.mjs";
import {loadRequestConfig} from "./request-api.mjs";
import {inviteFromHash,spotifyPlaylistUrl,validateContribution,itunesSearchUrl,parseITunesTracks} from "./collab-model.mjs";

const $=id=>document.getElementById(id);
const invite=inviteFromHash(location.hash);
const msg=$("room-status"),description=$("room-description"),heading=$("room-title");
const query=$("collab-search"),suggestionBox=$("collab-suggestions"),suggestionStatus=$("suggestion-status");
const feedback=$("collab-feedback"),selection=$("collab-selected"),submit=$("collab-submit");
const nameField=$("collab-name"),workspace=$("collab-workspace"),entriesBox=$("collab-entries");
let config=null,library=[],external=[],picked=null,roomOpen=false;
let searchTimer=null,searchController=null,searchVersion=0,submitting=false;
const cache=new Map();

function element(tag,cls,text) {
  const el=document.createElement(tag);
  if(cls)el.className=cls;
  if(text!==undefined)el.textContent=String(text);
  return el;
}
function browserId(){
  try {
    const key="ogvhs-collab-browser-v1";
    let id=localStorage.getItem(key);
    if(!id || !/^[0-9a-f-]{36}$/i.test(id)){
      id=crypto.randomUUID();localStorage.setItem(key,id);
    }
    return id;
  }catch{return crypto.randomUUID();}
}
const clientId=browserId();
function headers() {
  return {"Content-Type":"application/json","apikey":config.supabaseAnonKey,
    "x-dj-collab-invite":invite,"x-dj-collab-client":clientId};
}
function apiUrl(){return config.supabaseUrl+"/functions/v1/collab-room";}
function renderPicked(){
  selection.replaceChildren();
  if(!picked){
    selection.textContent="Choose a song or paste a playlist link.";
  } else if(picked.kind==="spotify_playlist") {
    selection.appendChild(element("strong","","Spotify playlist"));
    selection.appendChild(element("span","",picked.spotifyUrl));
  } else {
    selection.appendChild(element("strong","",picked.title));
    selection.appendChild(element("span","",picked.artist||"Artist not specified"));
    selection.appendChild(element("small","",picked.kind==="catalog"?"In the OGVHS library":
      picked.kind==="external"?"Suggested via Apple Music — not necessarily in the DJ library":"Manual suggestion"));
  }
  submit.disabled=!picked||submitting||!roomOpen||!config;
}
function choose(song){
  picked={...song};
  feedback.textContent="";
  renderPicked();
  selection.scrollIntoView({behavior:"smooth",block:"nearest"});
}
function renderSuggestions(){
  suggestionBox.replaceChildren();
  const q=query.value.trim();
  if(q.length<2){suggestionStatus.textContent="Type at least 2 characters to search your DJ's library.";return;}
  const local=searchCatalog(library,q,8).map(t=>({
    kind:"catalog",catalogId:t.id,title:t.title,artist:t.artist,album:t.album||""
  }));
  const localKeys=new Set(local.map(t=>normalize(t.artist+"|"+t.title)));
  const remote=external.filter(t=>!localKeys.has(normalize(t.artist+"|"+t.title))).slice(0,8);
  const all=[...local,...remote];
  suggestionStatus.textContent=all.length ? `${local.length} in OGVHS · ${remote.length} suggested via Apple Music` :
    "No matches yet. Try another search or enter the song manually.";
  for(const song of all){
    const button=element("button","collab-suggestion");
    button.type="button";
    const info=element("span");
    info.appendChild(element("strong","",song.title));
    info.appendChild(element("small","",song.artist+(song.album?" · "+song.album:"")));
    const badge=element("span","collab-source"+(song.kind==="external"?" external":""),
      song.kind==="external"?"Apple Music":"In library");
    button.append(info,badge);
    button.setAttribute("aria-label","Choose "+song.title+" by "+song.artist+
      (song.kind==="external"?" (external suggestion)":" (in DJ library)"));
    button.addEventListener("click",()=>choose(song));
    suggestionBox.appendChild(button);
  }
}
async function searchExternal(q,version){
  const url=itunesSearchUrl(q);
  if(!url)return;
  const cached=cache.get(q.toLowerCase());
  if(cached&&Date.now()-cached.at<60000){
    if(version===searchVersion){external=cached.tracks;renderSuggestions();}
    return;
  }
  searchController=new AbortController();
  try{
    const res=await fetch(url,{signal:searchController.signal,cache:"no-store"});
    if(!res.ok)throw Error("External search not available.");
    const payload=await res.json();
    const tracks=parseITunesTracks(payload);
    cache.set(q.toLowerCase(),{at:Date.now(),tracks});
    if(cache.size>25)cache.delete(cache.keys().next().value);
    if(version!==searchVersion)return;
    external=tracks;
    renderSuggestions();
  }catch(e){
    if(version!==searchVersion||e.name==="AbortError")return;
    suggestionStatus.textContent="Apple Music suggestions are temporarily unavailable. Local library and manual entry still work.";
  }
}
query.addEventListener("input",()=>{
  searchVersion++;
  const version=searchVersion,q=query.value.trim();
  clearTimeout(searchTimer);
  searchController?.abort();
  external=[];
  renderSuggestions();
  if(q.length>=3){
    searchTimer=setTimeout(()=>searchExternal(q,version),400);
  }
});
$("collab-manual-choose").addEventListener("click",()=>{
  choose({kind:"manual",title:$("collab-manual-title").value,artist:$("collab-manual-artist").value});
});
$("collab-spotify-choose").addEventListener("click",()=>{
  const url=spotifyPlaylistUrl($("collab-spotify-url").value);
  if(!url){feedback.textContent="Paste a valid Spotify playlist link.";return;}
  choose({kind:"spotify_playlist",spotifyUrl:url});
});

function renderEntries(entries){
  entriesBox.replaceChildren();
  $("room-count").textContent=entries.length+" recent contributions";
  if(!entries.length){entriesBox.appendChild(element("p","helper","Nobody has added anything yet. Get things started!"));return;}
  for(const e of entries){
    const row=element("article","collab-entry"),info=element("div");
    if(e.kind==="spotify_playlist"){
      const link=spotifyPlaylistUrl(e.spotify_url);
      const a=element("a","","Open Spotify playlist");
      if(link){a.href=link;a.target="_blank";a.rel="noopener noreferrer";}
      else a.removeAttribute("href");
      info.appendChild(a);
    }else{
      info.appendChild(element("strong","",e.title));
      info.appendChild(element("small","",e.artist||"Artist not specified"));
    }
    const who=e.contributor_name||"Anonymous";
    info.appendChild(element("small","",who+" · "+new Date(e.created_at).toLocaleDateString()));
    row.append(info,element("span","collab-source"+(e.kind==="external"?" external":""),
      e.kind==="catalog"?"In library":e.kind==="spotify_playlist"?"Spotify":e.kind==="external"?"External":"Suggested"));
    entriesBox.appendChild(row);
  }
}
async function refreshRoom(){
  if(!invite){heading.textContent="Invitation required";msg.textContent="Open the private link sent to you by DJ OGVHS.";return;}
  if(!config){heading.textContent="Collaboration preview";msg.textContent="The collaboration backend isn't connected yet.";return;}
  try{
    const res=await fetch(apiUrl(),{headers:headers(),cache:"no-store"});
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw Error(data.error||"Invitation unavailable.");
    heading.textContent=data.room.title;
    description.textContent=data.room.description;
    roomOpen=data.room.isOpen;
    workspace.hidden=!roomOpen;
    msg.textContent=roomOpen?"Invite-only playlist · Suggestions are open.":"This playlist is closed to new contributions.";
    renderPicked();
    renderEntries(data.entries||[]);
  }catch(e){heading.textContent="Can't open this room";msg.textContent=e.message;workspace.hidden=true;roomOpen=false;}
}
$("collab-refresh").addEventListener("click",refreshRoom);
submit.addEventListener("click",async()=>{
  if(!picked||!config||!roomOpen||submitting)return;
  let payload;
  try{payload=validateContribution({...picked,name:nameField.value});}
  catch(e){feedback.textContent=e.message;return;}
  submitting=true;renderPicked();feedback.textContent="Adding your contribution…";
  try{
    const res=await fetch(apiUrl(),{method:"POST",headers:headers(),body:JSON.stringify(payload)});
    const data=await res.json().catch(()=>({}));
    if(!res.ok||!data.accepted)throw Error(data.error||"Could not add your suggestion.");
    picked=null;
    feedback.textContent="Added! Thanks for building the playlist.";
    renderPicked();
    await refreshRoom();
  }catch(e){feedback.textContent=e.message;}
  finally{submitting=false;renderPicked();}
});
(async()=>{
  if(!invite){heading.textContent="Invitation required";msg.textContent="Ask DJ OGVHS for a private invitation link.";return;}
  try{config=await loadRequestConfig();}
  catch{config=null;}
  try{
    const response=await fetch("./public/catalog.json",{cache:"no-store"});
    if(response.ok){
      const all=await response.json();
      if(Array.isArray(all))library=all.filter(t=>t&&typeof t.id==="string"&&typeof t.title==="string"&&typeof t.artist==="string");
    }
  }catch{/* manual and external suggestions remain available */}
  renderSuggestions();
  await refreshRoom();
})();
