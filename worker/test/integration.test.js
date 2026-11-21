import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../index.js';
import {readFile} from 'node:fs/promises';

test('integrated CRM route is default-off before browser Origin gate, with no effects', async()=>{
 const ctx={waitUntil(){throw new Error('unexpected background work');}};
 const r=await worker.fetch(new Request('https://example.test/crm/chat',{method:'POST'}),{},ctx);
 assert.equal(r.status,503);assert.deepEqual(await r.json(),{error:'crm_disabled'});
});
test('disabled CRM flags preserve existing store health and FAQ paths',async()=>{
 const env={CRM_ENABLED:'false',CRM_LIMITS_VERIFIED:'false',CRM_OWNER_UID:'CRM_OWNER_UID_NOT_CONFIGURED'};
 const health=await worker.fetch(new Request('https://example.test/health'),env,{});
 assert.equal(health.status,200);assert.equal((await health.json()).service,'store-assistant');
 const faq=await worker.fetch(new Request('https://example.test/chat',{method:'POST',headers:{Origin:'https://one-for-all-good.web.app','Content-Type':'application/json'},body:JSON.stringify({message:'payment cash'})}),env,{});
 assert.equal(faq.status,200);assert.equal((await faq.json()).mode,'faq');
 const denied=await worker.fetch(new Request('https://example.test/chat',{method:'POST'}),env,{});assert.equal(denied.status,403);
});
test('checked-in configuration keeps both flags false, owner unpinned and POS denied',async()=>{
 const config=JSON.parse(await readFile(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
 assert.equal(config.vars.CRM_ENABLED,'false');assert.equal(config.vars.CRM_LIMITS_VERIFIED,'false');
 assert.equal(config.vars.CRM_OWNER_UID,'CRM_OWNER_UID_NOT_CONFIGURED');
 assert.equal(config.ratelimits.find(x=>x.name==='CRM_LIMITER').namespace_id,'1004');
 const rules=await readFile(new URL('../../firestore.rules',import.meta.url),'utf8');
 assert.ok(rules.includes('match /pos_tenants/{document=**} { allow read, write: if false; }'));
});
