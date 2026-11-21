import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,getDocs,collection,query,where,serverTimestamp} from 'firebase/firestore';
const env=await initializeTestEnvironment({projectId:'demo-crm-check',firestore:{host:'127.0.0.1',port:8085,rules:(await readFile(new URL('../firestore.rules',import.meta.url),'utf8')).replace('CRM_OWNER_UID_NOT_CONFIGURED','owner')}});
const id='conv-12345678901234567890';
await env.withSecurityRulesDisabled(async ctx=>{const db=ctx.firestore();for(const [p,data]of Object.entries({
 'staff/owner':{active:true,role:'owner'},'staff/a':{active:true,role:'agent'},'staff/b':{active:true,role:'agent'},'staff/inactive':{active:false,role:'agent'},
 ['conversations/'+id]:{assignee_uid:'a'},['conversations/'+id+'/messages/msg-1']:{body:'private'},
 ['conversations/'+id+'/order_cards/order-1']:{total:50},'customers/c':{phone:'private'},'orders/order-1':{total:50},
 'agent_metrics/a/days/2026-11-21':{handled:1},'auditLog/log1':{uid:'a'}
}))await setDoc(doc(db,p),data);});
const a=env.authenticatedContext('a').firestore(),b=env.authenticatedContext('b').firestore(),anon=env.unauthenticatedContext().firestore();
const owner=env.authenticatedContext('owner',{email:'ahmedsheta89@gmail.com',email_verified:true}).firestore();
test('assigned staff read parent, message and scoped card; other staff/public cannot',async()=>{for(const p of ['conversations/'+id,'conversations/'+id+'/messages/msg-1','conversations/'+id+'/order_cards/order-1']){await assertSucceeds(getDoc(doc(a,p)));await assertFails(getDoc(doc(b,p)));await assertFails(getDoc(doc(anon,p)));}});
test('unfiltered inbox denied; assigned query and owner list allowed',async()=>{await assertFails(getDocs(collection(a,'conversations')));await assertSucceeds(getDocs(query(collection(a,'conversations'),where('assignee_uid','==','a'))));await assertSucceeds(getDocs(collection(owner,'conversations')));});
test('staff cannot read global customers/orders or forge metrics, messages or audit',async()=>{for(const p of ['customers/c','orders/order-1'])await assertFails(getDoc(doc(a,p)));for(const p of ['agent_metrics/a/days/2026-11-21','auditLog/new','conversations/'+id+'/messages/new','conversations/'+id])await assertFails(setDoc(doc(a,p),{handled:999}));});
test('metrics document path valid and own-only; audit owner-only',async()=>{await assertSucceeds(getDoc(doc(a,'agent_metrics/a/days/2026-11-21')));await assertFails(getDoc(doc(b,'agent_metrics/a/days/2026-11-21')));await assertFails(getDoc(doc(a,'auditLog/log1')));await assertSucceeds(getDoc(doc(owner,'auditLog/log1')));});
test('presence uses server time and conversation permission',async()=>{await assertSucceeds(setDoc(doc(a,'conversations/'+id+'/presence/a'),{state:'typing',at:serverTimestamp()}));await assertFails(setDoc(doc(a,'conversations/'+id+'/presence/a'),{state:'typing',at:'fake'}));await assertFails(setDoc(doc(b,'conversations/'+id+'/presence/b'),{state:'typing',at:serverTimestamp()}));});
test('inactive staff denied; unverified legacy manager preserved until explicit migration',async()=>{await assertFails(getDoc(doc(env.authenticatedContext('inactive').firestore(),'conversations/'+id)));await assertSucceeds(getDoc(doc(env.authenticatedContext('spoof',{email:'ahmedsheta89@gmail.com',email_verified:false}).firestore(),'orders/order-1')));});
test.after(async()=>{await env.cleanup();});

test('production REST commit adapter enforces read-version guards and all-or-nothing writes',async()=>{
 const {firestoreStore}=await import('../worker/lib/firestore.js');
 // Adapter targets the real project name; emulator is isolated, never production.
 const base='http://127.0.0.1:8085/v1/projects/one-for-all-good/databases/(default)/documents';
 const call=async(_,path,method,body)=>{const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',Authorization:'Bearer owner'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw Object.assign(new Error(d.error?.message),{status:r.status});return d;};
 const seed=async(x)=>call(null,':commit','POST',{writes:[{update:{name:'projects/one-for-all-good/databases/(default)/documents/test/guard',fields:{n:{integerValue:String(x)}}}}]});
 await seed(1);const old=await (await fetch(base+'/test/guard',{headers:{Authorization:'Bearer owner'}})).json();
 const s=firestoreStore({},call),reads=new Map([['test/guard',{updateTime:old.updateTime}],['test/result',null]]);
 await s.commit([{path:'test/result',data:{ok:true}}],reads);
 await seed(2);const stale=new Map([['test/guard',{updateTime:old.updateTime}],['test/must-not-exist',null]]);
 await assert.rejects(s.commit([{path:'test/must-not-exist',data:{bad:true}}],stale));
 const absent=await fetch(base+'/test/must-not-exist',{headers:{Authorization:'Bearer owner'}});assert.equal(absent.status,404);
});
test('legacy store manager still works unverified, CRM owner pin requires verified UID; POS tenant denied',async()=>{
 const unverified=env.authenticatedContext('other',{email:'ahmedsheta89@gmail.com',email_verified:false}).firestore();
 await assertSucceeds(getDoc(doc(unverified,'orders/order-1')));
 await assertFails(getDoc(doc(unverified,'conversations/'+id)));
 await assertFails(getDoc(doc(owner,'pos_tenants/anything')));
 await assertFails(setDoc(doc(owner,'pos_tenants/anything'),{x:1}));
});
