// CRM foundation v2. Customer identity is anonymous or scoped to ONE proved order.
// A phone value never grants access to a customer or to other orders.
import {atomic} from './lib/atomic.js';
import {sha256hex, payloadHash, token24, CONV_ID_RE, TOKEN_RE, CLIENT_MSG_RE, CLIENT_CONV_RE, normalizePhone, isEgyptianMobile, ORDER_EVENT_TEXT} from './lib/util.js';
const ok = body => ({status:200,body:{ok:true,...body}});
const fail = (status,error) => ({status,body:{error}});
const timestamp = () => new Date().toISOString();
export const canAccess = (staff,c) => staff?.role === 'owner' || (!!staff && c.assignee_uid === staff.uid);
export const orderConversationId = async id => 'conv-'+(await sha256hex('order|'+id)).slice(0,20);
function initial(customerKey,name,hash,at) {
  return {channel:'store',status:'open',customer_key:customerKey,customer_name:name,
    customer_token_hash:hash,assignee_uid:null,department_id:null,tags:[],order_ids:[],
    preview:'',created_at:at,last_message_at:at,last_inbound_at:null,waiting_since:null,
    first_response_seconds:null,response_count:0,response_seconds_total:0,awaiting:'none',snoozed_until:null,last_seq:0};
}
async function access(tx,id,token) {
  if(!CONV_ID_RE.test(id||'') || !TOKEN_RE.test(token||'')) return null;
  const c = await tx.get('conversations/'+id);
  return c && c.customer_token_hash === await sha256hex(token) ? c : null;
}
async function append(tx,id,c,key,message,at,fingerprint) {
  const path = `conversations/${id}/messages/${key}`;
  const prior=await tx.get(path);
  if(prior){if(fingerprint&&prior.payload_hash!==fingerprint)throw Object.assign(new Error('idempotency_conflict'),{status:409});return false;}
  c.last_seq=(c.last_seq||0)+1; c.last_message_at=at;
  tx.set(path,{...message,...(fingerprint?{payload_hash:fingerprint}:{}),seq:c.last_seq,created_at:at});
  return true;
}
export function createCrm(store) {
  async function chatStart(b) {
    const text=typeof b.message==='string'?b.message.trim():'';
    if(!text || text.length>2000 || !CLIENT_MSG_RE.test(b.client_msg_id||'') || !TOKEN_RE.test(b.token||'')) return fail(400,'invalid_request');
    if(!b.conversation_id && !CLIENT_CONV_RE.test(b.client_conv_id||'')) return fail(400,'invalid_request');
    const id=b.conversation_id || 'conv-'+(await sha256hex('conv|'+b.client_conv_id)).slice(0,20);
    if(!CONV_ID_RE.test(id)) return fail(400,'invalid_request');
    const fingerprint=await payloadHash({message:text,name:typeof b.name==='string'?b.name.trim().slice(0,100):'',conversation_id:id});
    return atomic(store,async tx => {
      let c=await tx.get('conversations/'+id); const at=timestamp();
      if(c && !await access(tx,id,b.token)) return fail(403,'access_denied');
      if(!c && b.conversation_id) return fail(403,'access_denied');
      if(!c) {
        const key='anon-'+(await sha256hex(b.client_conv_id)).slice(0,24);
        const name=typeof b.name==='string'?b.name.trim().slice(0,100):'';
        await tx.get('customers/'+key);
        tx.set('customers/'+key,{name,phone:null,tags:[],order_ids:[],notes:'',first_seen:at,last_seen:at});
        c=initial(key,name,await sha256hex(b.token),at);
      }
      const added=await append(tx,id,c,'msg-'+await sha256hex(b.client_msg_id),{sender:'customer',sender_uid:null,kind:'text',body:text,order_id:null},at,fingerprint);
      if(added) {
        c.last_inbound_at=at; c.waiting_since=c.awaiting==='staff'?c.waiting_since:at;
        c.awaiting='staff'; c.preview=text.slice(0,140); c.status='open';
        tx.set('conversations/'+id,c);
      }
      return ok({conversation_id:id,token:b.token,deduplicated:!added});
    });
  }
  async function chatRead(b) {
    if(!Number.isSafeInteger(b.after??0) || (b.after??0)<0) return fail(400,'invalid_cursor');
    // Authorize before reading. Internal notes consume sequence positions too;
    // cursor advances across all fetched rows, even an all-note page.
    const c=await atomic(store,tx=>access(tx,b.conversation_id,b.token));
    if(!c) return fail(403,'access_denied');
    const rows=await store.listMessagesAfter(b.conversation_id,b.after||0,50);
    return ok({status:c.status,messages:rows.filter(m=>m.data.kind!=='note').map(m=>({id:m.id,...m.data,sender_uid:undefined,payload_hash:undefined})),
      next_cursor:rows.at(-1)?.data.seq ?? (b.after||0),has_more:rows.length===50});
  }
  async function chatRecover(b) {
    const p=normalizePhone(b.phone||''), code=String(b.order_code||'').trim().toUpperCase();
    if(!isEgyptianMobile(p)||!/^[A-Z2-9]{12}$/.test(code)) return fail(400,'invalid_request');
    const tracking=await store.get('tracking/'+await sha256hex(code+'|'+p));
    if(!tracking?.data.order_id) return fail(404,'not_found');
    const id=await orderConversationId(tracking.data.order_id);
    const token=token24();
    return atomic(store,async tx=>{
      const order=await tx.get('orders/'+tracking.data.order_id);
      const c=await tx.get('conversations/'+id);
      if(!order||order.code!==code||normalizePhone(order.customer_phone)!==p||!c||!c.order_ids.includes(tracking.data.order_id)) return fail(404,'not_found');
      tx.set('conversations/'+id,{...c,customer_token_hash:await sha256hex(token)});
      return ok({conversation_id:id,token});
    });
  }
  // Called on order creation AND persisted lifecycle changes. Hook is retry-safe.
  // Dedicated order conversation prevents proof of one order revealing others.
  async function linkOrderToCrm(order) {
    if(!/^[A-Za-z0-9_-]{1,100}$/.test(order.id||'')||!isEgyptianMobile(normalizePhone(order.customer_phone||''))) return fail(400,'invalid_order');
    const id=await orderConversationId(order.id), key=await sha256hex(normalizePhone(order.customer_phone));
    return atomic(store,async tx=>{
      // Re-read persisted state inside the unit of work; guard against a stale
      // order hook arriving after a newer lifecycle event.
      const persisted=await tx.get('orders/'+order.id);
      if(!persisted)return fail(404,'not_found');
      order={id:order.id,...persisted};
      const at=timestamp(); let c=await tx.get('conversations/'+id);
      const customer=await tx.get('customers/'+key);
      if(!customer) tx.set('customers/'+key,{name:order.customer_name||'',phone:order.customer_phone,tags:[],order_ids:[order.id],notes:'',first_seen:at,last_seen:at});
      else tx.set('customers/'+key,{...customer,order_ids:[...new Set([...customer.order_ids,order.id])],last_seen:at});
      if(!c) c=initial(key,order.customer_name||'',await sha256hex(token24()),at);
      c.order_ids=[order.id];
      const event='order-'+await sha256hex(order.id+'|'+order.status+'|'+(order.updated_at||order.created_at||''));
      const text=(ORDER_EVENT_TEXT[order.status]||'حالة الطلب اتحدثت')+'، كود الطلب '+order.code;
      if(await append(tx,id,c,event,{sender:'system',sender_uid:null,kind:'order_event',body:text,order_id:order.id},at)) c.preview=text;
      const cardPath=`conversations/${id}/order_cards/${order.id}`; await tx.get(cardPath);
      tx.set(cardPath,{code:order.code,status:order.status,total:order.total,expected_at:order.expected_at||null,
        items:(order.items||[]).map(i=>({name:i.product_name,quantity:i.quantity})),updated_at:at});
      tx.set('conversations/'+id,c);
      tx.set('orders/'+order.id,{...persisted,crm_pending:false});
      return ok({conversation_id:id});
    });
  }
  async function orderEvent(b) {
    if(!/^[A-Za-z0-9_-]{1,100}$/.test(b.order_id||'')) return fail(400,'invalid_order');
    const row=await store.get('orders/'+b.order_id); if(!row) return fail(404,'not_found');
    return linkOrderToCrm({id:b.order_id,...row.data});
  }
  return {chatStart,chatRead,chatRecover,linkOrderToCrm,orderEvent};
}
const ORIGINS=new Set(['https://one-for-all-good.web.app','https://one-for-all-good.firebaseapp.com','https://one-for-all-good-crm.web.app']);
export function response(r,origin) {
  return new Response(JSON.stringify(r.body),{status:r.status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin',
    'Access-Control-Allow-Origin':ORIGINS.has(origin)?origin:'https://one-for-all-good.web.app','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization'}});
}
export async function crmFetch(request,env,ctx,origin,store) {
  const path=new URL(request.url).pathname;
  const route={'/crm/chat':'chatStart','/crm/chat/read':'chatRead','/crm/chat/recover':'chatRecover','/crm/events/order':'orderEvent'}[path];
  if(!route) return null;
  if(env.CRM_ENABLED!=='true'||!env.CRM_OWNER_UID)return response(fail(503,'crm_disabled'),origin);
  if(request.method==='OPTIONS') return response(ok({}),origin);
  if(request.method!=='POST') return response(fail(405,'post_required'),origin);
  const pos=route==='orderEvent';
  if(pos ? (!env.POS_SHARED_SECRET||request.headers.get('Authorization')!=='Bearer '+env.POS_SHARED_SECRET) : !ORIGINS.has(origin)) return response(fail(403,'access_denied'),origin);
  // Fail closed if limiter was not configured. Namespace 1004 is reserved for CRM.
  if(!env.CRM_LIMITER || !(await env.CRM_LIMITER.limit({key:request.headers.get('CF-Connecting-IP')||'unknown'})).success) return response(fail(429,'too_many_requests'),origin);
  const raw=await request.text(); if(raw.length>6500) return response(fail(413,'too_large'),origin);
  let b;try{b=JSON.parse(raw);}catch{return response(fail(400,'invalid_json'),origin);}
  if(!b||typeof b!=='object'||Array.isArray(b)) return response(fail(400,'invalid_json'),origin);
  try{return response(await createCrm(store)[route](b),origin);}catch(e){return response(fail(e.status===409?409:503,e.status===409?'idempotency_conflict':'retry_later'),origin);}
}
