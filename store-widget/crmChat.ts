import {pendingId,clearPending,fingerprint} from '../packages/crm-schema/retry.js';
// Customer-side client. Phone never selects a conversation. Order recovery uses
// code+phone proof, scoped to that order only. Tokens never appear in URLs.
const ENDPOINT='https://oneforallgood-assistant.oneforallgood-store.workers.dev';
const KEY='ofag-crm-chat-v2';
export type CrmVisibleMessage={id:string;seq:number;sender:'customer'|'agent'|'system'|'ai';kind:'text'|'order_event';body:string;created_at:string;order_id:string|null};
export type CrmSession={conversation_id?:string;client_conv_id?:string;token:string};
export function loadSession():CrmSession|null{try{const s=JSON.parse(localStorage.getItem(KEY)||'null');return s&&typeof s.token==='string'?s:null;}catch{return null;}}
function save(s:CrmSession){localStorage.setItem(KEY,JSON.stringify(s));}
export function clearSession(){localStorage.removeItem(KEY);}
function session():CrmSession{
 const existing=loadSession();if(existing)return existing;
 const s={client_conv_id:crypto.randomUUID(),token:Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('')};save(s);return s;
}
async function call(path:string,body:object){const r=await fetch(ENDPOINT+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'});const b=await r.json();if(!r.ok)throw new Error(r.status===429?'استنى دقيقة وجرب تاني.':'تعذر تنفيذ العملية. راجع الاتصال والكود.');return b;}

export async function sendToPharmacy(input:{message:string;name?:string}){
 try{const s=session(),key=await fingerprint(JSON.stringify({token:s.token,...input})),client_msg_id=pendingId(localStorage,key,()=>crypto.randomUUID());
 const b=await call('/crm/chat',{...s,...input,client_msg_id});const next={conversation_id:b.conversation_id,token:b.token};save(next);clearPending(localStorage,key);return {ok:true as const,session:next};
 }catch(e){return {ok:false as const,message:e instanceof Error?e.message:'تعذر الإرسال'};}
}
export async function readMessages(after=0){try{const s=loadSession();if(!s?.conversation_id)return {ok:false as const};const b=await call('/crm/chat/read',{...s,after});return {ok:true as const,status:b.status,messages:b.messages as CrmVisibleMessage[],next_cursor:b.next_cursor as number,has_more:b.has_more as boolean};}catch{return {ok:false as const};}}
export async function recoverByOrder(order_code:string,phone:string){try{const b=await call('/crm/chat/recover',{order_code,phone});const s={conversation_id:b.conversation_id,token:b.token};save(s);return {ok:true as const,session:s};}catch(e){return {ok:false as const,message:e instanceof Error?e.message:'تعذر استرجاع المحادثة'};}}
// Widget integration: opt into saved human chat explicitly, keep assistant mode
// separate; poll ~15s only while open. Dedup rendered messages by id; advance
// next_cursor across every page (including pages containing only hidden notes).
// Show has_more paging and never imply a human reply was delivered when offline.
// Recovery rotates the order conversation's token, signing out older browsers.
