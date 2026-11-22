import {productPhotoIdentity} from '../src/lib/productPhotoMatching.ts';
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
 const before=await current();approved.image_revision=before.image_revision;await runtime.setProductHidden(approved.id,true);const hidden=await current();assert.deepEqual(hidden,{...before,owner_hidden:true,public_visible:false});
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
const photoId='qa-photo-link',photoRef=doc(db,'products',photoId),oldPhoto='https://example.test/old-photo.jpg';
const uploadedPhoto='https://oneforallgood-assistant.oneforallgood-store.workers.dev/media/'+'a'.repeat(64);
const photoCurrent=async()=>({...(await getDoc(photoRef)).data(),id:photoId});
test('actual image-only transaction preserves concurrent business/hide edits and resets review',async()=>{
 await runtime.upsertProduct({...approved,id:photoId,imageUrl:oldPhoto});const original=await photoCurrent();
 await runtime.upsertProduct({...original,price:99,stock_quantity:17,description:'Concurrent edit retained'});await runtime.setProductHidden(photoId,true);const latest=await photoCurrent();
 await runtime.assignProductPhoto({productId:photoId,imageUrl:uploadedPhoto,expectedImageUrl:oldPhoto,expectedIdentity:productPhotoIdentity(original),expectedImageRevision:original.image_revision||''});
 const after=await photoCurrent();assert.notEqual(after.image_revision,latest.image_revision);assert.deepEqual(after,{...latest,imageUrl:uploadedPhoto,image_revision:after.image_revision,content_review_status:'unreviewed',public_visible:false});
});
test('retrying an already linked photo does not undo a later human review',async()=>{
 await runtime.upsertProduct({...await photoCurrent(),content_review_status:'reviewed'});const reviewed=await photoCurrent();
 await runtime.assignProductPhoto({productId:photoId,imageUrl:uploadedPhoto,expectedImageUrl:oldPhoto,expectedIdentity:productPhotoIdentity(reviewed),expectedImageRevision:reviewed.image_revision||''});assert.deepEqual(await photoCurrent(),reviewed);
});
test('image transaction rejects a concurrently changed photo and changed pack identity',async()=>{
 const original=await photoCurrent(),different=uploadedPhoto.replace(/a{64}$/,'b'.repeat(64)),next=uploadedPhoto.replace(/a{64}$/,'c'.repeat(64));
 await runtime.upsertProduct({...original,imageUrl:different});const changed=await photoCurrent();
 await assert.rejects(runtime.assignProductPhoto({productId:photoId,imageUrl:next,expectedImageUrl:original.imageUrl,expectedIdentity:productPhotoIdentity(original),expectedImageRevision:original.image_revision||''}),/صورة المنتج اتغيرت/);assert.deepEqual(await photoCurrent(),changed);
 await runtime.upsertProduct({...changed,name:changed.name+' changed pack',unit:'bottle'});const renamed=await photoCurrent();
 await assert.rejects(runtime.assignProductPhoto({productId:photoId,imageUrl:next,expectedImageUrl:different,expectedIdentity:productPhotoIdentity(changed),expectedImageRevision:changed.image_revision||''}),/بيانات العبوة اتغيرت/);assert.deepEqual(await photoCurrent(),renamed);
});
test('image transaction refuses an invalid URL and cannot recreate a deleted product',async()=>{
 const original=await photoCurrent();await assert.rejects(runtime.assignProductPhoto({productId:photoId,imageUrl:'https://example.test/not-uploaded.jpg',expectedImageUrl:original.imageUrl,expectedIdentity:productPhotoIdentity(original),expectedImageRevision:original.image_revision||''}),/ربط الصورة/);assert.deepEqual(await photoCurrent(),original);
 await deleteDoc(photoRef);await assert.rejects(runtime.assignProductPhoto({productId:photoId,imageUrl:uploadedPhoto,expectedImageUrl:original.imageUrl,expectedIdentity:productPhotoIdentity(original),expectedImageRevision:original.image_revision||''}),/لم يعد موجودًا/);assert.equal((await getDoc(photoRef)).exists(),false);
});
test('catalog ID is the real document ID even if legacy payload contains another ID',async()=>{
 const id='qa-id-binding';const raw={...approved,id:'not-the-document-id',public_visible:true,owner_hidden:false};
 const fields=Object.fromEntries(Object.entries(raw).map(([k,v])=>[k,typeof v==='boolean'?{booleanValue:v}:typeof v==='number'?{integerValue:String(v)}:{stringValue:v}]));
 const seeded=await fetch('http://127.0.0.1:8086/v1/projects/demo-theme-check/databases/(default)/documents/products/'+id,{method:'PATCH',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({fields})});assert.ok(seeded.ok);
 const rows=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{stop?.();reject(new Error('catalog listener timeout'));},4000);let stop=runtime.watchProducts(rows=>{if(rows.some(p=>p.id===id)){clearTimeout(timer);stop?.();resolve(rows);}},true);});assert.ok(rows.some(p=>p.id===id));assert.ok(!rows.some(p=>p.id==='not-the-document-id'));assert.equal((await runtime.getPublicProduct(id)).id,id);await deleteDoc(doc(db,'products',id));
});
test('photo revision rejects remove-and-readd and delete-and-recreate ABA changes',async()=>{
 const id='qa-photo-aba',ref=doc(db,'products',id);await runtime.upsertProduct({...approved,id});const first={...(await getDoc(ref)).data(),id};
 await runtime.upsertProduct({...first,imageUrl:oldPhoto});const middle={...(await getDoc(ref)).data(),id};await runtime.upsertProduct({...middle,imageUrl:undefined});const restored={...(await getDoc(ref)).data(),id};assert.notEqual(restored.image_revision,first.image_revision);
 const proposal={productId:id,imageUrl:uploadedPhoto,expectedImageUrl:'',expectedIdentity:productPhotoIdentity(first),expectedImageRevision:first.image_revision};await assert.rejects(runtime.assignProductPhoto(proposal),/صورة المنتج اتغيرت/);assert.deepEqual((await getDoc(ref)).data(),Object.fromEntries(Object.entries(restored).filter(([k])=>k!=='id')));
 await deleteDoc(ref);await runtime.upsertProduct({...first});await assert.rejects(runtime.assignProductPhoto(proposal),/صورة المنتج اتغيرت/);await deleteDoc(ref);
});
test('a stale full editor cannot overwrite a newer photo, but fresh price edits preserve its revision',async()=>{
 const id='qa-photo-editor',ref=doc(db,'products',id);await runtime.upsertProduct({...approved,id});const before={...(await getDoc(ref)).data(),id};await runtime.upsertProduct({...before,imageUrl:uploadedPhoto});const newer={...(await getDoc(ref)).data(),id};
 await assert.rejects(runtime.upsertProduct({...before,price:777}),/صورة الصنف اتغيرت/);assert.equal((await getDoc(ref)).data().imageUrl,uploadedPhoto);await runtime.upsertProduct({...newer,price:88});assert.equal((await getDoc(ref)).data().image_revision,newer.image_revision);
 const priced={...(await getDoc(ref)).data(),id};await runtime.upsertProduct({...priced,imageUrl:undefined});const restored=(await getDoc(ref)).data();assert.notEqual(restored.image_revision,before.image_revision);assert.equal(restored.imageUrl,before.imageUrl);await assert.rejects(runtime.upsertProduct({...before,price:777}),/صورة الصنف اتغيرت/);assert.deepEqual((await getDoc(ref)).data(),restored);await deleteDoc(ref);
});
test('workbook photo replacement changes its revision, while a price-only workbook update preserves it',async()=>{
 const id='qa-photo-import',ref=doc(db,'products',id);await runtime.upsertProduct({...approved,id,imageUrl:oldPhoto});const first={...(await getDoc(ref)).data(),id};await runtime.bulkImportProducts([{...first,price:66}],()=>{});const priced={...(await getDoc(ref)).data(),id};assert.equal(priced.image_revision,first.image_revision);await runtime.bulkImportProducts([{...priced,imageUrl:uploadedPhoto}],()=>{});assert.notEqual((await getDoc(ref)).data().image_revision,first.image_revision);await deleteDoc(ref);
});
test.after(async()=>{await deleteDoc(photoRef);await deleteDoc(doc(db,'products',approved.id));await deleteDoc(doc(db,'products','qa-new-import'));await deleteApp(app);await unlink(file);});
