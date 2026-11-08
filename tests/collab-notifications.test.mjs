import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';

const source=(await readFile(new URL('../supabase/functions/collab-access/index.ts',import.meta.url),'utf8'))
  .replace(/import \{ createClient \} from [^;]+;/,'');
function setup({deliveryOK=true,rpcStatus='accepted',rpcError=null}={}){
  let handler;
  const state={sent:null,claimed:null,deliveries:[],logs:[],saved:0};
  const db={rpc:async()=>{state.saved++;return {data:{status:rpcStatus},error:rpcError};},from:()=>{
    let patch,filters={},claim=false;
    const q={update(p){patch=p;return q;},eq(k,v){filters[k]=v;return q;},is(){return q;},or(){claim=true;return q;},select(){return q;},
      maybeSingle:async()=>{if(state.sent||state.claimed)return {data:null,error:null};state.claimed=patch.notification_claimed_at;return {data:{id:'request-id'},error:null};},
      then(resolve){if(!claim&&filters.notification_claimed_at===state.claimed){state.sent=patch.notification_sent_at??state.sent;state.claimed=patch.notification_claimed_at;}resolve({error:null});}};
    return q;
  }};
  const env={SUPABASE_URL:'https://pgufhgmkqgpjoddxvzoa.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test-only',DJ_COLLAB_RATE_SECRET:'test-only',DJ_ALLOWED_ORIGINS:'https://collab.ogvhs.com',DJ_COLLAB_NOTIFICATION_FORM_ID:'abcdefgh'};
  vm.runInNewContext(stripTypeScriptTypes(source),{TextEncoder,crypto,URL,Response,AbortSignal,Date,
    Deno:{env:{get:k=>env[k]},serve:h=>{handler=h;}},createClient:()=>db,
    console:{error:(...v)=>state.logs.push(v.join(' '))},
    fetch:async(url,options)=>{state.deliveries.push({url,body:JSON.parse(options.body)});return Response.json({ok:deliveryOK},{status:deliveryOK?200:503});}
  });
  const send=(body={email:'visitor@example.com'},method='POST')=>handler(new Request('https://pgufhgmkqgpjoddxvzoa.supabase.co/functions/v1/collab-access',{
    method,headers:{Origin:'https://collab.ogvhs.com','Content-Type':'application/json','x-dj-collab-client':'59bca307-bfd7-4d2d-a079-eaa0a3154495'},...(method==='POST'?{body:JSON.stringify(body)}:{})}));
  return {state,send};
}
test('saved request sends one minimal notification and repeated requests do not resend',async()=>{
  const {state,send}=setup();
  assert.equal((await send()).status,201);assert.equal((await send()).status,201);
  assert.equal(state.deliveries.length,1);assert.ok(state.sent);
  assert.equal(state.deliveries[0].url,'https://formspree.io/f/abcdefgh');
  assert.equal(state.deliveries[0].body.email,'visitor@example.com');
  assert.match(state.deliveries[0].body.message,/collab-admin.html/);
  assert.equal(Object.keys(state.deliveries[0].body).length,3);
});
test('notification failure preserves the request and allows a subsequent retry',async()=>{
  const {state,send}=setup({deliveryOK:false});
  assert.equal((await send()).status,201);assert.equal(state.saved,1);assert.equal(state.sent,null);assert.equal(state.claimed,null);
  assert.equal((await send()).status,201);assert.equal(state.deliveries.length,2);
  assert.ok(state.logs.every(s=>!s.includes('visitor@example.com')));
});
test('invalid input, honeypot and unauthorized inbox reads never email',async()=>{
  const {state,send}=setup();
  assert.equal((await send({email:'invalid'})).status,400);
  assert.equal((await send({email:'visitor@example.com',website:'bot'})).status,200);
  assert.equal((await send(undefined,'GET')).status,401);
  assert.equal(state.deliveries.length,0);assert.equal(state.saved,0);
});
test('rate-limited and failed saves never notify',async()=>{
  for(const options of [{rpcStatus:'limit'},{rpcError:{code:'TEST'}}]){
    const {state,send}=setup(options);assert.ok([429,503].includes((await send()).status));assert.equal(state.deliveries.length,0);
  }
});
