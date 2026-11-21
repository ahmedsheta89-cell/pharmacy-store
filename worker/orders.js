const PROJECT='one-for-all-good';
const BASE=`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const NAME=`projects/${PROJECT}/databases/(default)/documents`;
let cached;
const enc=new TextEncoder();
const b64=v=>btoa(String.fromCharCode(...new Uint8Array(v))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
const j64=v=>b64(enc.encode(JSON.stringify(v)));
export async function digest(v){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(v)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
async function access(env){
 if(cached?.until>Date.now())return cached.token;
 const sa=JSON.parse(env.FIREBASE_SERVICE_ACCOUNT),now=Math.floor(Date.now()/1000);
 const input=j64({alg:'RS256',typ:'JWT'})+'.'+j64({iss:sa.client_email,scope:'https://www.googleapis.com/auth/datastore',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
 const pem=Uint8Array.from(atob(sa.private_key.replace(/-----[^-]+-----|\s/g,'')),c=>c.charCodeAt(0));
 const key=await crypto.subtle.importKey('pkcs8',pem,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
 const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,enc.encode(input));
 const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:input+'.'+b64(signature)})});
 const data=await r.json();if(!r.ok||!data.access_token)throw new Error('backend_auth_unavailable');cached={token:data.access_token,until:Date.now()+3300000};return cached.token;
}
function val(v){if(v===null)return {nullValue:null};if(typeof v==='string')return {stringValue:v};if(typeof v==='boolean')return {booleanValue:v};if(typeof v==='number')return Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v};if(Array.isArray(v))return {arrayValue:{values:v.map(val)}};return {mapValue:{fields:fields(v)}};}
function fields(o){return Object.fromEntries(Object.entries(o).filter(([,v])=>v!==undefined).map(([k,v])=>[k,val(v)]));}
function decode(v){if('stringValue'in v)return v.stringValue;if('integerValue'in v)return Number(v.integerValue);if('doubleValue'in v)return v.doubleValue;if('booleanValue'in v)return v.booleanValue;if('nullValue'in v)return null;if(v.arrayValue)return (v.arrayValue.values||[]).map(decode);if(v.mapValue)return object(v.mapValue.fields||{});if(v.timestampValue)return v.timestampValue;return null;}
function object(f){return Object.fromEntries(Object.entries(f||{}).map(([k,v])=>[k,decode(v)]));}
async function db(env,path,method='GET',body){const r=await fetch(BASE+path,{method,headers:{Authorization:'Bearer '+await access(env),'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});let data=await r.json();if(!r.ok){const e=new Error(data.error?.status||'database_unavailable');e.status=r.status;throw e;}return data;}
async function get(env,path){try{const d=await db(env,'/'+path);return {data:object(d.fields),updateTime:d.updateTime};}catch(e){if(e.status===404)return null;throw e;}}
const phone=v=>String(v).replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[^0-9]/g,'').replace(/^(0020|20)/,'').replace(/^0/,'');
function code(){const a='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';return [...crypto.getRandomValues(new Uint8Array(12))].map(x=>a[x&31]).join('');}
const labels={new:'new',confirmed:'confirmed',preparing:'preparing',out_for_delivery:'out_for_delivery',delivered:'delivered',cancelled:'cancelled'};
async function notify(env,id,snapshot=null){
 let snap=snapshot||await get(env,'orders/'+id);if(!snap)return;let o=snap.data;if(o.qa_test)return;
 const state=o.notification_state||{},now=Date.now(),active=!['delivered','cancelled'].includes(o.status),late=active&&o.expected_at&&Date.parse(o.expected_at)<now;
 let events=[];if(state.status!==o.status)events.push(o.status==='new'?'new_order':'status_changed');if(o.expected_at&&state.expected_at!==o.expected_at)events.push('eta_changed');if(late&&state.late_for!==o.expected_at)events.push('overdue');if(!events.length){if(o.notification_pending)await db(env,':commit','POST',{writes:[{update:{name:NAME+'/orders/'+id,fields:fields({notification_pending:false})},updateMask:{fieldPaths:['notification_pending']},currentDocument:{updateTime:snap.updateTime}}]});return;}
 if(state.sending_at&&now-Date.parse(state.sending_at)<120000)return;
 const sending={...state,sending_at:new Date().toISOString()};
 let claim;try{claim=await db(env,':commit','POST',{writes:[{update:{name:NAME+'/orders/'+id,fields:fields({notification_state:sending})},updateMask:{fieldPaths:['notification_state']},currentDocument:{updateTime:snap.updateTime}}]});}catch(e){if([409,412].includes(e.status))return;throw e;}
 // The email bridge deliberately excludes customer identity, phone, address and items.
 const metadata={event:events.join(','),order_code:o.code,status:labels[o.status]||o.status,total_egp:o.total,expected_at:o.expected_at||null,admin_url:'https://one-for-all-good.web.app/admin'};
 let sent=false,messageId=null;
 try{
 const r=await fetch('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'api-key':env.BREVO_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({sender:{name:'One For All Good',email:'oneforallgood.store@gmail.com'},to:[{email:'hdhalv@mail.instinct.com'}],subject:`Store ${events.join('/')} | ${o.code}`,textContent:JSON.stringify(metadata,null,2),tags:['store-order-notification']})});sent=r.ok;if(sent){const result=await r.json();messageId=result.messageId||null;}
 }catch{}
 const next=sent?{status:o.status,expected_at:o.expected_at||null,late_for:late?o.expected_at:(state.late_for||null),sent_at:new Date().toISOString(),message_id:messageId}:{...state,last_error_at:new Date().toISOString(),sending_at:null};
 await db(env,':commit','POST',{writes:[{update:{name:NAME+'/orders/'+id,fields:fields({notification_state:next,notification_pending:!sent})},updateMask:{fieldPaths:['notification_state','notification_pending']},currentDocument:{updateTime:claim.writeResults[0].updateTime}}]});
}
export async function createOrder(request,env,ctx){
 const raw=await request.text();if(raw.length>18000)return {status:413,body:{error:'too_large'}};
 let b;try{b=JSON.parse(raw);}catch{return {status:400,body:{error:'invalid_json'}};}
 const name=typeof b.customer_name==='string'?b.customer_name.trim():'',address=typeof b.customer_address==='string'?b.customer_address.trim():'',p=phone(b.customer_phone||''),notes=typeof b.notes==='string'?b.notes.trim():'';
 if(!/^[0-9a-f-]{36}$/i.test(b.request_id||'')||name.length<2||name.length>100||address.length<5||address.length>500||!/^1[0125][0-9]{8}$/.test(p)||notes.length>1000||!Array.isArray(b.items)||b.items.length<1||b.items.length>50)return {status:400,body:{error:'invalid_order'}};
 const id='web-'+await digest(b.request_id);let existing=await get(env,'orders/'+id);if(existing)return {status:200,body:{ok:true,orderCode:existing.data.code,total:existing.data.total}};
 if(env.ORDER_LIMITER){const rate=await env.ORDER_LIMITER.limit({key:request.headers.get('CF-Connecting-IP')||'unknown'});if(!rate.success)return {status:429,body:{error:'too_many_orders'}};}
 const seen=new Set(),items=[];let total=0;
 for(const item of b.items){if(typeof item.product_id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(item.product_id)||seen.has(item.product_id)||!Number.isInteger(item.quantity)||item.quantity<1||item.quantity>20)return {status:400,body:{error:'invalid_item'}};seen.add(item.product_id);}
 // One batch request keeps large carts below the free Worker's subrequest cap.
 const productRows=await db(env,':batchGet','POST',{documents:b.items.map(item=>NAME+'/products/'+item.product_id)});
 const catalog=new Map(productRows.filter(row=>row.found).map(row=>[row.found.name.split('/').pop(),object(row.found.fields)]));
 for(const item of b.items){const product=catalog.get(item.product_id),price=product?.price;if(!product||product.public_visible!==true||product.advertising_status!=='approved'||product.content_review_status!=='reviewed'||!['non_prescription','not_medicine'].includes(product.prescription_status)||typeof price!=='number'||!Number.isFinite(price)||price<0||(product.stock_quantity!==undefined&&item.quantity>product.stock_quantity))return {status:400,body:{error:'product_unavailable'}};items.push({product_id:item.product_id,product_name:product.name,unit_price:price,quantity:item.quantity});total+=Math.round(price*100)*item.quantity;}
 total/=100;if(total<=0||total>1000000)return {status:400,body:{error:'invalid_total'}};
 // Price changes require the customer to review the new total before submitting again.
 if(typeof b.total!=='number'||Math.round(b.total*100)!==Math.round(total*100))return {status:409,body:{error:'price_changed',total}};
 const c=code(),tracking=await digest(c+'|'+p),at=new Date().toISOString(),history=[{status:'new',at}];
 const order={customer_name:name,customer_phone:'0'+p,customer_address:address,notes:notes||null,total,items,code:c,tracking_id:tracking,status:'new',created_at:at,updated_at:at,history,notification_pending:true};
 try{await db(env,':commit','POST',{writes:[{update:{name:NAME+'/orders/'+id,fields:fields(order)},currentDocument:{exists:false}},{update:{name:NAME+'/tracking/'+tracking,fields:fields({order_id:id,status:'new',total,created_at:at,history})},currentDocument:{exists:false}}]});}catch(e){if(e.status===409){existing=await get(env,'orders/'+id);if(existing)return {status:200,body:{ok:true,orderCode:existing.data.code,total:existing.data.total}};}throw e;}
 ctx.waitUntil(notify(env,id).catch(()=>{}));return {status:201,body:{ok:true,orderCode:c,total}};
}
export async function notifyRequest(request,env,ctx){
 const token=request.headers.get('Authorization')?.replace(/^Bearer /,'');if(!token)return {status:401,body:{error:'auth_required'}};
 const r=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=AIzaSyCsRvLEcaGr1DV6a6HFHmR4Xe9mzqgpApQ',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:token})});const user=await r.json();if(!r.ok||user.users?.[0]?.email!=='ahmedsheta89@gmail.com')return {status:403,body:{error:'manager_only'}};
 const raw=await request.text();if(raw.length>300)return {status:400,body:{error:'invalid_request'}};let b;try{b=JSON.parse(raw);}catch{return {status:400,body:{error:'invalid_request'}};}if(!/^[a-zA-Z0-9_-]{1,100}$/.test(b.order_id||''))return {status:400,body:{error:'invalid_request'}};ctx.waitUntil(notify(env,b.order_id).catch(()=>{}));return {status:202,body:{ok:true}};
}
export async function sweep(env){
 if(!env.FIREBASE_SERVICE_ACCOUNT||!env.BREVO_API_KEY)return;
 const rows=await db(env,':runQuery','POST',{structuredQuery:{from:[{collectionId:'orders'}],where:{fieldFilter:{field:{fieldPath:'status'},op:'IN',value:val(['new','confirmed','preparing','out_for_delivery'])}},limit:100}});
 const pending=await db(env,':runQuery','POST',{structuredQuery:{from:[{collectionId:'orders'}],where:{fieldFilter:{field:{fieldPath:'notification_pending'},op:'EQUAL',value:val(true)}},limit:100}});
 const docs=new Map([...rows,...pending].filter(x=>x.document).map(x=>[x.document.name,x.document]));
 let handled=0;
 for(const d of docs.values()){const data=object(d.fields),state=data.notification_state||{},late=!['delivered','cancelled'].includes(data.status)&&data.expected_at&&Date.parse(data.expected_at)<Date.now();
 if(!data.notification_pending&&state.status===data.status&&(!data.expected_at||state.expected_at===data.expected_at)&&(!late||state.late_for===data.expected_at))continue;
 // At most ten changed orders per pass, safely below the free 50-subrequest limit.
 if(handled++>=10)break;const id=d.name.split('/').pop();try{await notify(env,id,{data,updateTime:d.updateTime});}catch{}}
}

// Private gateway shares the existing service credential and Firestore codec.
export const posDatabase={request:db,fields,object,name:NAME};
