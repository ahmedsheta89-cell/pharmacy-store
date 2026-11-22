import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,getDocs,collection,serverTimestamp} from 'firebase/firestore';
const env=await initializeTestEnvironment({projectId:'demo-theme-check',firestore:{host:'127.0.0.1',port:8086,rules:await readFile(new URL('../firestore.rules',import.meta.url),'utf8')}});
const owner=env.authenticatedContext('owner',{email:'ahmedsheta89@gmail.com',email_verified:false}).firestore(),other=env.authenticatedContext('other',{email:'other@example.test'}).firestore(),anon=env.unauthenticatedContext().firestore();
const data=()=>({theme:'royal-amethyst',accepting_orders:false,closed_message:'Synthetic test',seasonal:{auto:false,ramadan:{enabled:false,start:'',end:''},eid_fitr:{enabled:false,start:'',end:''},eid_adha:{enabled:false,start:'',end:''}},updated_at:serverTimestamp(),updated_by:'owner'});
test('legacy manager can set each allowed theme, including while unverified',async()=>{for(const theme of ['legacy','noir-gold','violet-pop','terracotta-dune','midnight-azure','brutalist-paper','royal-amethyst','ramadan','eid-fitr','eid-adha'])await assertSucceeds(setDoc(doc(owner,'store_public/appearance'),{...data(),theme}));});
test('public can get appearance only, not list or write',async()=>{await assertSucceeds(getDoc(doc(anon,'store_public/appearance')));await assertFails(getDocs(collection(anon,'store_public')));await assertFails(setDoc(doc(anon,'store_public/appearance'),data()));await assertFails(setDoc(doc(other,'store_public/appearance'),data()));});
test('private config, arbitrary theme/CSS/fields and forged audit fail',async()=>{for(const change of [{theme:'<script>'},{css:'body{display:none}'},{closed_message:'x'.repeat(241)},{updated_by:'another'},{updated_at:'forged'},{accepting_orders:'false'}])await assertFails(setDoc(doc(owner,'store_public/appearance'),{...data(),...change}));await assertFails(setDoc(doc(owner,'store_public/private'),data()));});
test('seasonal windows validate schema, ordered ranges and overlaps',async()=>{
 const set=seasonal=>setDoc(doc(owner,'store_public/appearance'),{...data(),seasonal});
 const s=data().seasonal;const on=(start,end)=>({enabled:true,start,end});
 await assertSucceeds(set({...s,auto:true,ramadan:on('2027-02-08','2027-03-08'),eid_fitr:on('2027-03-09','2027-03-12'),eid_adha:on('2027-05-16','2027-05-20')}));
 for(const seasonal of [{...s,auto:'yes'},{...s,ramadan:on('2027-03-09','2027-03-08')},{...s,ramadan:on('2027-02-08','2027-03-09'),eid_fitr:on('2027-03-09','2027-03-12')},{...s,eid_adha:{...s.eid_adha,css:'bad'}},{auto:false,ramadan:s.ramadan}])await assertFails(set(seasonal));
});
test.after(async()=>env.cleanup());
test('REST commit rejects a stale appearance guard without writing order or tracking',async()=>{
 const base='http://127.0.0.1:8086/v1/projects/demo-theme-check/databases/(default)/documents';
 const call=async(path,method='GET',body)=>fetch(base+path,{method,headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 const snapshot=await (await call('/store_public/appearance')).json();
 await assertSucceeds(setDoc(doc(owner,'store_public/appearance'),{...data(),accepting_orders:true}));
 const root='projects/demo-theme-check/databases/(default)/documents/';
 const r=await call(':commit','POST',{writes:[{update:{name:root+'orders/qa-race',fields:{code:{stringValue:'NOT-REAL'}}},currentDocument:{exists:false}},{update:{name:root+'tracking/qa-race',fields:{status:{stringValue:'new'}}},currentDocument:{exists:false}},{verify:root+'store_public/appearance',currentDocument:{updateTime:snapshot.updateTime}}]});
 const rejection=await r.json();assert.equal(rejection.error.status,'FAILED_PRECONDITION');assert.ok(!r.ok);assert.equal((await call('/orders/qa-race')).status,404);assert.equal((await call('/tracking/qa-race')).status,404);
});
