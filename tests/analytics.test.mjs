import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analyticsBlocked, pageId, sourceDomain, linkMeasurement} from '../src/analytics-model.mjs';
test('previous declines and GPC block analytics regardless of acceptance', () => {
  assert.equal(analyticsBlocked({getItem:()=> 'declined'},{}),true);
  assert.equal(analyticsBlocked({getItem:()=> 'accepted'},{globalPrivacyControl:true}),true);
  assert.equal(analyticsBlocked({getItem:()=> null},{}),false);
});
test('measurements exclude private URL values, arbitrary paths and non-web links', () => {
  assert.equal(pageId('/rooms/private-owner'),'/other');
  assert.equal(pageId('/mix.html'),'/mix.html');
  assert.equal(sourceDomain('https://example.com/private?email=secret#token'),'example.com');
  assert.deepEqual(linkMeasurement('https://example.com/private?email=secret#token','https://ogvhs.com'),{type:'outbound_click',data:{domain:'example.com'}});
  assert.deepEqual(linkMeasurement('/music/private.flac?signature=secret','https://ogvhs.com'),{type:'file_download',data:{extension:'flac'}});
  assert.equal(linkMeasurement('mailto:private@example.com','https://ogvhs.com'),null);
  assert.equal(linkMeasurement('/about.html','https://ogvhs.com'),null);
});

test('a declined visitor gets the control but no configuration fetch or AWS initialization', async () => {
  const saved = Object.fromEntries(['document','navigator','localStorage','location','fetch'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
  let initialize; let controls=0; let requests=0;
  const footer={appendChild(){controls++;}};
  const document={readyState:'loading',cookie:'',querySelector:()=>footer,getElementById:()=>null,
    createElement:()=>({setAttribute(){},addEventListener(){}}),addEventListener:(type,fn)=>{if(type==='DOMContentLoaded')initialize=fn;}};
  const globals={document,navigator:{},localStorage:{getItem:()=> 'declined'},location:{hostname:'ogvhs.com'},fetch:()=>{requests++;throw Error('Unexpected request');}};
  try {
    for(const [k,v] of Object.entries(globals))Object.defineProperty(globalThis,k,{value:v,configurable:true,writable:true});
    await import('../src/analytics.mjs?optout-test');
    await initialize();
    assert.equal(controls,1); assert.equal(requests,0);
  } finally {
    for(const [k,d] of Object.entries(saved))if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];
  }
});

test('guest credentials stay in memory, refresh on expiry, and coalesce simultaneous requests', async () => {
  const {memoryCredentials} = await import('../src/analytics-credentials.mjs');
  let clock=1000000; const calls=[];
  const provider=memoryCredentials('us-east-2:test',async(url,options)=>{
    calls.push({url,options});
    return {ok:true,json:async()=>options.headers['X-Amz-Target'].endsWith('.GetId') ? {IdentityId:'guest'} : {Credentials:{AccessKeyId:'test-key',SecretKey:'test-secret',SessionToken:'test-token',Expiration:clock/1000+3600}}};
  },()=>clock);
  const [a,b]=await Promise.all([provider(),provider()]);
  assert.equal(a,b);assert.equal(calls.length,2);
  await provider();assert.equal(calls.length,2);
  clock+=3600000;await provider();assert.equal(calls.length,3);
  assert.equal(calls[0].options.credentials,'omit');
  assert.deepEqual(JSON.parse(calls[0].options.body),{IdentityPoolId:'us-east-2:test'});
});
