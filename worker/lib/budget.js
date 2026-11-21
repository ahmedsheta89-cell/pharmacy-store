// Explicit shared network budget. Counts attempted network requests, not SDK
// method names. A request uses one instance; a scheduled notification+CRM sweep
// MUST share the same instance. No activation based on local timings alone.
export function ioBudget(limit=20,maxMs=10000){
 const started=Date.now();let used=0;
 return {charge(){if(used>=limit||Date.now()-started>=maxMs)throw Object.assign(new Error('crm_overloaded'),{status:503});used++;},get used(){return used;},get elapsedMs(){return Date.now()-started;}};
}
