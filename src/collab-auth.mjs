const settings=await fetch('./public/collab-config.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Sign-in configuration unavailable.');return r.json();});
const store=sessionStorage;
const toBase64=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const random=()=>toBase64(crypto.getRandomValues(new Uint8Array(32)));
export async function signIn(){
  const state=random(),verifier=random();store.setItem('ogvhs-collab-oauth',JSON.stringify({state,verifier,time:Date.now()}));
  const challenge=toBase64(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
  const url=new URL('/oauth2/authorize',settings.loginDomain);
  url.search=new URLSearchParams({response_type:'code',client_id:settings.clientId,redirect_uri:location.origin+'/collab-admin.html',scope:'openid email',state,code_challenge:challenge,code_challenge_method:'S256'});
  location.assign(url);
}
export function signOut(){
  store.removeItem('ogvhs-collab-session');store.removeItem('ogvhs-collab-oauth');
  const url=new URL('/logout',settings.loginDomain);url.search=new URLSearchParams({client_id:settings.clientId,logout_uri:location.origin+'/collab-admin.html'});location.assign(url);
}
export let authError='';
const query=new URLSearchParams(location.search);
try {
if(query.has('code')||query.has('error')){
  const pending=JSON.parse(store.getItem('ogvhs-collab-oauth')||'null');store.removeItem('ogvhs-collab-oauth');history.replaceState(null,'','/collab-admin.html');
  if(!pending||pending.state!==query.get('state')||Date.now()-pending.time>600000)throw new Error('Sign-in expired. Please sign in again.');
  if(query.has('error'))throw new Error('Sign-in was cancelled. Please try again.');
  const r=await fetch(settings.loginDomain+'/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',client_id:settings.clientId,code:query.get('code'),redirect_uri:location.origin+'/collab-admin.html',code_verifier:pending.verifier})});
  if(!r.ok)throw new Error('Unable to complete sign-in. Please try again.');
  const t=await r.json();store.setItem('ogvhs-collab-session',JSON.stringify({idToken:t.id_token,expires:Date.now()+(t.expires_in-30)*1000}));
}
} catch(error) {store.removeItem('ogvhs-collab-session');authError=error.message||'Sign-in failed. Please try again.';}
export async function authenticatedFetch(path,options={}){
  const session=JSON.parse(store.getItem('ogvhs-collab-session')||'null');
  if(!session||session.expires<=Date.now())return new Response(JSON.stringify({error:'Sign in to your DJ account.'}),{status:401,headers:{'Content-Type':'application/json'}});
  const r=await fetch(settings.apiUrl+path,{...options,cache:'no-store',headers:{...options.headers,Authorization:'Bearer '+session.idToken}});
  if(r.status===401)store.removeItem('ogvhs-collab-session');
  return r;
}
export const signedIn=()=>{const s=JSON.parse(store.getItem('ogvhs-collab-session')||'null');return !!s&&s.expires>Date.now();};

export function getSession(){const s=JSON.parse(store.getItem("ogvhs-collab-session")||"null");return s&&s.expires>Date.now()?{access_token:s.idToken}:null;}
export function sessionExpiry(){const s=JSON.parse(store.getItem("ogvhs-collab-session")||"null");return s?.expires||0;}
