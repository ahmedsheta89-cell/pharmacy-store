// Read-only local archive interface. Separate key, never the POS write key.
import {response} from './crm.js';
const fail=(status,error)=>({status,body:{error}});
export async function crmArchiveFetch(request,env,ctx,origin,store) {
  if(new URL(request.url).pathname!=='/crm/archive')return null;
  if(env.CRM_ENABLED!=='true'||!env.CRM_OWNER_UID)return response(fail(503,'crm_disabled'),origin);
  if(request.method!=='POST'||!env.CRM_ARCHIVE_SECRET||request.headers.get('Authorization')!=='Bearer '+env.CRM_ARCHIVE_SECRET)return response(fail(403,'access_denied'),origin);
  if(!env.CRM_LIMITER||!(await env.CRM_LIMITER.limit({key:'archive'})).success)return response(fail(429,'too_many_requests'),origin);
  const raw=await request.text();if(raw.length>1000)return response(fail(413,'too_large'),origin);
  let b;try{b=JSON.parse(raw);}catch{return response(fail(400,'invalid_json'),origin);}
  if(!b||typeof b!=='object')return response(fail(400,'invalid_json'),origin);
  if(b.mode==='index') {
    if(b.after&&!/^conv-[a-zA-Z0-9]{20}$/.test(b.after))return response(fail(400,'invalid_cursor'),origin);
    const rows=await store.listConversationIds(b.after||'',20);
    const conversations=rows.map(r=>{const {customer_token_hash,...data}=r.data;return {id:r.id,...data};});
    return response({status:200,body:{ok:true,conversations,next_cursor:rows.at(-1)?.id||b.after||'',has_more:rows.length===20}},origin);
  }
  if(b.mode==='messages'&&/^conv-[a-zA-Z0-9]{20}$/.test(b.conversation_id||'')&&Number.isSafeInteger(b.after??0)&&(b.after??0)>=0) {
    const rows=await store.listMessagesAfter(b.conversation_id,b.after||0,50);
    return response({status:200,body:{ok:true,messages:rows.map(r=>({id:r.id,...r.data})),next_cursor:rows.at(-1)?.data.seq??(b.after||0),has_more:rows.length===50}},origin);
  }
  return response(fail(400,'invalid_request'),origin);
}
