import {posDatabase} from './orders.js';
import {verifyPosToken} from './pos-auth.js';
export const PROTOCOL='pharmacy-sync-v1',MAX_OPS=5,MAX_BODY=256*1024,MAX_PAYLOAD=64*1024;
const ID=/^[a-zA-Z0-9_-]{1,100}$/,HASH=/^[A-F0-9]{64}$/,DEVICE=/^[a-f0-9]{32}$/;
const encoder=new TextEncoder(),size=s=>encoder.encode(s).length;
const reset={content_reviewer:'',content_reviewed_at:'',content_version:'',content_review_status:'unreviewed',prescription_status:'unknown',advertising_status:'unreviewed',public_visible:false};
export const PATCH=['name','price','unit','imageUrl','description','dosage_information','usage_instructions','warnings','content_source',...Object.keys(reset)];
const DRAFT_KEYS=['id','name','nameEn','category','price','unit','imageUrl','description','dosage_information','usage_instructions','warnings','content_source',...Object.keys(reset),'stock_quantity'];
function exact(o,keys){return o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));}
function str(v,max,min=0){return typeof v==='string'&&v.length>=min&&v.length<=max;}
export async function payloadHash(kind,payload){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(kind+'\n'+payload)))].map(n=>n.toString(16).padStart(2,'0')).join('').toUpperCase();}
export function parseDraft(raw){
 let p;try{p=JSON.parse(raw);}catch{throw new Error('invalid_payload');}
 if(!exact(p,['storeId','expectedCloudVersion','draft'])||!ID.test(p.storeId)||!str(p.expectedCloudVersion,100,1)||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(p.expectedCloudVersion))throw new Error('invalid_payload');
 const d=p.draft;
 if(!exact(d,DRAFT_KEYS)||d.id!==p.storeId||!str(d.name,1000,1)||!d.name.trim()||!str(d.unit,100,1)||!d.unit.trim()||typeof d.price!=='number'||!Number.isFinite(d.price)||d.price<0||d.price>100000000||Math.round(d.price*100)/100!==d.price||d.nameEn!==''||d.category!=='uncategorized'||d.stock_quantity!==null)throw new Error('invalid_payload');
 for(const k of ['description','dosage_information','usage_instructions','warnings'])if(!str(d[k],12000))throw new Error('invalid_payload');
 if(!str(d.imageUrl,2000)||!str(d.content_source,2000)||Object.entries(reset).some(([k,v])=>d[k]!==v))throw new Error('invalid_payload');
 for(const k of ['imageUrl','content_source'])if(d[k]){let u;try{u=new URL(d[k]);}catch{throw new Error('invalid_url');}if(u.protocol!=='https:'||u.username||u.password)throw new Error('invalid_url');}
 return {...p,patch:Object.fromEntries(PATCH.map(k=>[k,Object.hasOwn(reset,k)?reset[k]:d[k]]))};
}
function paths(uid,device,branch){const tenant='pos_tenants/one-for-all-good';return [tenant,tenant+'/members/'+uid,tenant+'/branches/'+branch,tenant+'/devices/'+device];}
export function authorize(rows,uid,branch){
 const [t,m,b,d]=rows.map(r=>r?.data);
 const includes=(a,v)=>Array.isArray(a)&&a.includes(v);
 return t?.enabled===true&&t.firebaseProject==='one-for-all-good'&&t.schemaVersion===1&&m?.enabled===true&&m.role==='owner'&&includes(m.branches,branch)&&includes(m.capabilities,'catalog.draft.write')&&includes(m.allowedKinds,'CATALOG_DRAFT')&&b?.enabled===true&&d?.enabled===true&&d.ownerUid===uid&&includes(d.allowedUids,uid)&&d.branchId===branch&&!d.revokedAtUtc&&includes(d.capabilities,'catalog.draft.write')&&includes(d.allowedKinds,'CATALOG_DRAFT');
}
export function firestoreStore(env){
 const {request,fields,object,name}=posDatabase;
 return {
  async begin(){const t=(await request(env,':beginTransaction','POST',{options:{readWrite:{}}})).transaction;if(typeof t!=='string'||!t)throw new Error('transaction_unavailable');return t;},
  async read(keys,transaction){const rows=await request(env,':batchGet','POST',{documents:keys.map(k=>name+'/'+k),...(transaction?{transaction}:{})});const found=new Map(rows.filter(r=>r.found).map(r=>[r.found.name,{data:object(r.found.fields),updateTime:r.found.updateTime}]));return keys.map(k=>found.get(name+'/'+k)||null);},
  async commit(transaction,product,version,patch,operation,record){await request(env,':commit','POST',{transaction,writes:[{update:{name:name+'/'+product,fields:fields(patch)},updateMask:{fieldPaths:PATCH},currentDocument:{updateTime:version}},{update:{name:name+'/'+operation,fields:fields(record)},currentDocument:{exists:false},updateTransforms:[{fieldPath:'appliedAtUtc',setToServerValue:'REQUEST_TIME'}]}]});},
  async rollback(transaction){await request(env,':rollback','POST',{transaction});}
 };
}
// No retry on an ambiguous commit: omit the entire response and let the durable outbox replay.
export async function applyOperation(store,uid,batch,op){
 const tx=await store.begin();let finished=false;
 try{
  const memberPaths=paths(uid,batch.Device,batch.Branch),ledger=memberPaths[0]+'/devices/'+batch.Device+'/operations/'+op.Id;
  const p=op.Kind==='CATALOG_DRAFT'?parseDraft(op.Payload):null;
  const rows=await store.read([...memberPaths,ledger,...(p?['products/'+p.storeId]:[])],tx);
  if(!authorize(rows,uid,batch.Branch))return {accepted:false,error:'not_authorized'};
  const prior=rows[4];
  if(prior){const r=prior.data;return r.payloadHash===op.PayloadHash&&r.kind===op.Kind&&r.branchId===batch.Branch&&r.userUid===uid&&r.result==='APPLIED'?{accepted:true,error:null}:{accepted:false,error:'operation_conflict'};}
  if(!p)return {accepted:false,error:'unsupported_kind'};
  if(!rows[5])return {accepted:false,error:'product_not_found'};
  if(rows[5].updateTime!==p.expectedCloudVersion)return {accepted:false,error:'version_conflict'};
  await store.commit(tx,'products/'+p.storeId,p.expectedCloudVersion,p.patch,ledger,{payloadHash:op.PayloadHash,kind:op.Kind,branchId:batch.Branch,userUid:uid,storeProductId:p.storeId,result:'APPLIED'});
  finished=true;return {accepted:true,error:null};
 }finally{if(!finished)await store.rollback(tx).catch(()=>{});}
}
function response(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});}
async function boundedText(request){if(Number(request.headers.get('Content-Length')||0)>MAX_BODY)throw new Error('too_large');const reader=request.body?.getReader();if(!reader)throw new Error('invalid_request');let n=0,parts=[];try{while(true){const {done,value}=await reader.read();if(done)break;n+=value.length;if(n>MAX_BODY){await reader.cancel();throw new Error('too_large');}parts.push(value);}const out=new Uint8Array(n);let at=0;for(const p of parts){out.set(p,at);at+=p.length;}return new TextDecoder('utf-8',{fatal:true}).decode(out);}finally{reader.releaseLock();}}
export async function posSync(request,env,deps={}){
 if(env.POS_SYNC_ENABLED!=='true')return response({error:'pos_sync_disabled'},503);
 if(request.method!=='POST')return response({error:'method_not_allowed'},405);
 if(!env.POS_SYNC_LIMITER)return response({error:'pos_sync_not_configured'},503);
 if(!(await env.POS_SYNC_LIMITER.limit({key:request.headers.get('CF-Connecting-IP')||'unknown'})).success)return response({error:'rate_limited'},429);
 if(!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json'))return response({error:'json_required'},415);
 const bearer=request.headers.get('Authorization')?.match(/^Bearer ([A-Za-z0-9_.-]{1,12000})$/)?.[1];if(!bearer)return response({error:'auth_required'},401);
 let uid;try{uid=await(deps.verify||verifyPosToken)(bearer);}catch(e){return response({error:e.message==='auth_unavailable'?'auth_unavailable':'invalid_token'},e.message==='auth_unavailable'?503:401);}
 if(typeof uid!=='string'||!uid.length||uid.length>128||!/^[a-zA-Z0-9_-]+$/.test(uid))return response({error:'invalid_token'},401);
 if(!(await env.POS_SYNC_LIMITER.limit({key:'uid:'+uid})).success)return response({error:'rate_limited'},429);
 let b;try{b=JSON.parse(await boundedText(request));}catch(e){return response({error:e.message==='too_large'?'too_large':'invalid_json'},e.message==='too_large'?413:400);}
 if(!exact(b,['Protocol','Branch','Device','Operations'])||b.Protocol!==PROTOCOL||b.Branch!=='main'||!DEVICE.test(b.Device)||!Array.isArray(b.Operations)||b.Operations.length<1||b.Operations.length>MAX_OPS)return response({error:'invalid_envelope',maxOperations:MAX_OPS},400);
 const ids=new Set();for(const o of b.Operations){if(!exact(o,['Id','Kind','Payload','PayloadHash'])||!str(o.Id,100,1)||!ID.test(o.Id)||ids.has(o.Id)||!str(o.Kind,40,1)||!ID.test(o.Kind)||!str(o.Payload,MAX_PAYLOAD)||size(o.Payload)>MAX_PAYLOAD||typeof o.PayloadHash!=='string'||!HASH.test(o.PayloadHash))return response({error:'invalid_operation'},400);ids.add(o.Id);}
 const store=deps.store||firestoreStore(env);
 try{
  // Current membership check even for unsupported payloads. Commits reread this within the transaction.
  if(!authorize(await store.read(paths(uid,b.Device,b.Branch)),uid,b.Branch))return response({error:'not_authorized'},403);
  const a=[];
  for(const o of b.Operations){let r;if(await payloadHash(o.Kind,o.Payload)!==o.PayloadHash)r={accepted:false,error:'hash_mismatch'};else{try{if(o.Kind==='CATALOG_DRAFT')parseDraft(o.Payload);}catch(e){r={accepted:false,error:e.message};}r??=await applyOperation(store,uid,b,o);}a.push({Id:o.Id,PayloadHash:o.PayloadHash,Accepted:r.accepted,Error:r.error});}
  return response({Protocol:PROTOCOL,Acknowledgments:a});
 }catch{return response({error:'sync_temporarily_unavailable'},503);}
}
