// Source-wiring entry point. Default off. Do not set either activation flag until
// live UID/rules review, privacy/real-capture review and measured Workers Free
// CPU/subrequest load tests have passed. This module makes no scheduled change.
import {firestoreStore} from './lib/firestore.js';
import {ioBudget} from './lib/budget.js';
import {crmFetch,response} from './crm.js';
import {crmStaffFetch} from './crm-staff.js';
import {crmArchiveFetch} from './crm-archive.js';
export async function crmGateway(request,env,ctx){
 if(!new URL(request.url).pathname.startsWith('/crm/'))return null;
 const origin=request.headers.get('Origin')||'';
 if(env.CRM_ENABLED!=='true'||env.CRM_LIMITS_VERIFIED!=='true'||!env.CRM_OWNER_UID)return response({status:503,body:{error:'crm_disabled'}},origin);
 const scoped={...env,CRM_IO_BUDGET:ioBudget(20,10000)},store=firestoreStore(scoped);
 try{return await crmStaffFetch(request,scoped,ctx,origin,store)||await crmArchiveFetch(request,scoped,ctx,origin,store)||await crmFetch(request,scoped,ctx,origin,store)||response({status:404,body:{error:'not_found'}},origin);}
 catch(e){return response({status:e.status===409?409:503,body:{error:e.status===409?'idempotency_conflict':'retry_later'}},origin);}
}
