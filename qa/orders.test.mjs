import test from 'node:test';import assert from 'node:assert/strict';import {createOrder} from '../worker/orders.js';
let token;
const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const bytes=await crypto.subtle.exportKey('pkcs8',pair.privateKey);
const env={FIREBASE_SERVICE_ACCOUNT:JSON.stringify({client_email:'qa@example.test',private_key:'-----BEGIN PRIVATE KEY-----\n'+Buffer.from(bytes).toString('base64')+'\n-----END PRIVATE KEY-----'})};
const value=v=>typeof v==='string'?{stringValue:v}:typeof v==='boolean'?{booleanValue:v}:{integerValue:String(v)};
const fields=o=>Object.fromEntries(Object.entries(o).map(([k,v])=>[k,value(v)]));
const payload={request_id:'12345678-1234-1234-1234-123456789012',customer_name:'Synthetic Test',customer_phone:'01012345678',customer_address:'Synthetic address only',notes:'',total:25,items:[{product_id:'fixture',quantity:1}]};
function request(){return new Request('https://example.test/orders',{method:'POST',body:JSON.stringify(payload)});}
async function scenario(options={}){
 const original=globalThis.fetch,calls=[],background=[];globalThis.fetch=async(url,init)=>{calls.push({url,body:init?.body});
  if(url.includes('oauth2.googleapis.com'))return Response.json({access_token:'qa-token'});
  if(url.endsWith('/orders/web-'+await (await import('../worker/orders.js')).digest(payload.request_id)))return options.existing?Response.json({fields:fields({code:'QAEXISTING',total:25}),updateTime:'2026-01-01T00:00:00Z'}):Response.json({}, {status:404});
  if(url.endsWith('/store_private/delivery_policy'))return Response.json({}, {status:404});
  if(url.endsWith('/store_public/appearance'))return options.readFails?Response.json({}, {status:500}):options.missing?Response.json({}, {status:404}):Response.json({fields:fields({accepting_orders:!options.closed}),updateTime:'2026-11-21T00:00:00Z'});
  if(url.endsWith(':batchGet'))return Response.json([{found:{name:'projects/one-for-all-good/databases/(default)/documents/products/fixture',updateTime:options.missingVersion?undefined:'2026-11-22T03:00:00Z',fields:fields({name:'Fixture',price:25,public_visible:true,advertising_status:'approved',content_review_status:'reviewed',prescription_status:'not_medicine',stock_quantity:10,...options.product})}}]);
  if(url.endsWith(':commit'))return options.commitConflict?Response.json({error:{status:'FAILED_PRECONDITION'}},{status:412}):Response.json({});
  throw new Error('unexpected QA network destination');
 };
 try{const result=await createOrder(request(),env,{waitUntil(p){background.push(p);}});return {result,calls};}finally{await Promise.all(background);globalThis.fetch=original;}
}
test('closed store denies new order before product lookup or commit',async()=>{const {result,calls}=await scenario({closed:true});assert.equal(result.body.error,'store_closed');assert.ok(!calls.some(x=>x.url.endsWith(':commit')||x.url.endsWith(':batchGet')));});
test('settings read failure fails closed',async()=>{const {result}=await scenario({readFails:true});assert.equal(result.body.error,'settings_unavailable');});
test('successful open order commit guards appearance version atomically',async()=>{const {result,calls}=await scenario();assert.equal(result.status,201);const body=JSON.parse(calls.find(x=>x.url.endsWith(':commit')).body);const guard=body.writes.find(x=>x.verify);assert.ok(guard.verify.endsWith('/store_public/appearance'));assert.deepEqual(guard.currentDocument,{updateTime:'2026-11-21T00:00:00Z'});});
test('missing initial settings preserves old open behavior with exists:false guard',async()=>{const {result,calls}=await scenario({missing:true});assert.equal(result.status,201);const body=JSON.parse(calls.find(x=>x.url.endsWith(':commit')).body);assert.deepEqual(body.writes.find(x=>x.verify).currentDocument,{exists:false});});
test('existing retry remains recoverable while closed without a second order',async()=>{const {result,calls}=await scenario({existing:true,closed:true});assert.equal(result.status,200);assert.equal(result.body.orderCode,'QAEXISTING');assert.ok(!calls.some(x=>x.url.includes('store_public')||x.url.endsWith(':commit')));});
test('close or product hide racing checkout prevents commit success',async()=>{const {result}=await scenario({commitConflict:true});assert.equal(result.status,409);assert.equal(result.body.error,'catalog_changed');});

test('stale cart cannot order an owner-hidden product even with stale public_visible:true',async()=>{const {result,calls}=await scenario({product:{owner_hidden:true}});assert.equal(result.body.error,'product_unavailable');assert.ok(!calls.some(x=>x.url.endsWith(':commit')));});
test('backend independently enforces review, ad and prescription gates',async()=>{for(const product of [{public_visible:false},{content_review_status:'unreviewed'},{advertising_status:'blocked'},{prescription_status:'prescription'},{prescription_status:'unknown'}]){const {result,calls}=await scenario({product});assert.equal(result.body.error,'product_unavailable');assert.ok(!calls.some(x=>x.url.endsWith(':commit')));}});
test('order commit also verifies every product snapshot against concurrent hiding/price changes',async()=>{const {result,calls}=await scenario();assert.equal(result.status,201);const body=JSON.parse(calls.find(x=>x.url.endsWith(':commit')).body);assert.deepEqual(body.writes.find(x=>x.verify?.endsWith('/products/fixture')),{verify:'projects/one-for-all-good/databases/(default)/documents/products/fixture',currentDocument:{updateTime:'2026-11-22T03:00:00Z'}});});
test('unverifiable product snapshot fails closed',async()=>{const {result}=await scenario({missingVersion:true});assert.equal(result.body.error,'product_unavailable');});
