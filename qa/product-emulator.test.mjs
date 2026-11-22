import test from 'node:test';import assert from 'node:assert/strict';import {readFile,writeFile,unlink} from 'node:fs/promises';
import {createRequire} from 'node:module';import {initializeApp,deleteApp} from 'firebase/app';
import {getFirestore,connectFirestoreEmulator,doc,setDoc,getDoc,deleteDoc} from 'firebase/firestore';
const require=createRequire(new URL('../package.json',import.meta.url));const {build}=createRequire(require.resolve('vite/package.json'))('esbuild');
// Compile a test-only copy of the actual production data layer. No hook ships.
const source=await readFile(new URL('../src/lib/firebase.ts',import.meta.url),'utf8');
const result=await build({stdin:{contents:source+'\nexport const __qaDb=()=>ensure().db;',resolveDir:new URL('../src/lib/',import.meta.url).pathname,loader:'ts'},bundle:true,format:'esm',platform:'node',external:['firebase/*'],define:{'import.meta.env':'{}'},write:false});
const file=new URL('./.product-test-runtime.mjs',import.meta.url);await writeFile(file,result.outputFiles[0].text);
const app=initializeApp({projectId:'demo-theme-check',apiKey:'demo-only-key',appId:'demo-only-app'});
const db=getFirestore(app);connectFirestoreEmulator(db,'127.0.0.1',8086,{mockUserToken:{sub:'owner-runtime',email:'ahmedsheta89@gmail.com'}});
const runtime=await import(file.href);assert.equal(runtime.__qaDb(),db);
const approved={id:'qa-visibility',name:'Synthetic product only',nameEn:'Synthetic',price:25,category:'devices',unit:'piece',description:'Fixture only',content_review_status:'reviewed',advertising_status:'approved',prescription_status:'not_medicine',content_source:'Synthetic QA',content_reviewer:'Synthetic QA',content_reviewed_at:'2026-11-22',content_version:'1'};
const current=async()=> (await getDoc(doc(db,'products',approved.id))).data();
test('actual product data layer toggles only visibility and preserves all business fields',async()=>{
 await runtime.upsertProduct(approved);assert.equal((await current()).public_visible,true);
 const before=await current();await runtime.setProductHidden(approved.id,true);const hidden=await current();assert.deepEqual(hidden,{...before,owner_hidden:true,public_visible:false});
 await runtime.setProductHidden(approved.id,false);assert.deepEqual(await current(),before);
});
test('saving a stale edit cannot undo a hide; approving a manually hidden record keeps it hidden',async()=>{
 await runtime.setProductHidden(approved.id,true);
 await runtime.upsertProduct({...approved,owner_hidden:false,price:26});let p=await current();assert.equal(p.owner_hidden,true);assert.equal(p.public_visible,false);assert.equal(p.price,26);
 await runtime.upsertProduct({...approved,content_review_status:'unreviewed'});await runtime.setProductHidden(approved.id,false);assert.equal((await current()).public_visible,false);await runtime.setProductHidden(approved.id,true);
 await runtime.upsertProduct(approved);p=await current();assert.equal(p.owner_hidden,true);assert.equal(p.public_visible,false);
});
test('actual XLSX update preserves live hide regardless of stale spreadsheet state; resets approvals',async()=>{
 let saved=0;await runtime.bulkImportProducts([{...approved,owner_hidden:false}],n=>saved=n);assert.equal(saved,1);const p=await current();assert.equal(p.owner_hidden,true);assert.equal(p.public_visible,false);assert.equal(p.content_review_status,'unreviewed');assert.equal(p.advertising_status,'unreviewed');assert.equal(p.prescription_status,'unknown');
 await runtime.setProductHidden(approved.id,false);assert.equal((await current()).public_visible,false);await runtime.setProductHidden(approved.id,true);
 await runtime.upsertProduct(approved);assert.equal((await current()).public_visible,false);await runtime.setProductHidden(approved.id,false);assert.equal((await current()).public_visible,true);
});
test('XLSX new rows cannot import approvals or a forged visibility flag',async()=>{await runtime.bulkImportProducts([{...approved,id:'qa-new-import',public_visible:true,owner_hidden:true}],()=>{});const p=(await getDoc(doc(db,'products','qa-new-import'))).data();assert.equal(p.public_visible,false);assert.equal(p.owner_hidden,false);assert.equal(p.content_review_status,'unreviewed');});
test('actual legacy document with no visibility or approval fields supports both toggles without publishing',async()=>{
 const ref=doc(db,'products','qa-legacy');const seed=await fetch('http://127.0.0.1:8086/v1/projects/demo-theme-check/databases/(default)/documents/products/qa-legacy',{method:'PATCH',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({fields:{name:{stringValue:'Legacy fixture only'},price:{integerValue:'5'}}})});assert.ok(seed.ok);
 await runtime.setProductHidden('qa-legacy',true);assert.deepEqual((await getDoc(ref)).data(),{name:'Legacy fixture only',price:5,owner_hidden:true,public_visible:false});
 await runtime.setProductHidden('qa-legacy',false);assert.deepEqual((await getDoc(ref)).data(),{name:'Legacy fixture only',price:5,owner_hidden:false,public_visible:false});await deleteDoc(ref);
});
test.after(async()=>{await deleteDoc(doc(db,'products',approved.id));await deleteDoc(doc(db,'products','qa-new-import'));await deleteApp(app);await unlink(file);});
