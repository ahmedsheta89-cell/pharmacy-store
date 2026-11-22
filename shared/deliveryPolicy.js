export const EMPTY_DELIVERY_POLICY = Object.freeze({version:'unconfigured',enabled:false,zones:[]});
const keys=(object,allowed)=>object&&typeof object==='object'&&!Array.isArray(object)&&Object.keys(object).every(key=>allowed.includes(key));
const cents=value=>Number.isSafeInteger(value)&&value>=0&&value<=100000000;
export function validateDeliveryPolicy(input){
 if(!keys(input,['enabled','zones'])||typeof input.enabled!=='boolean'||!Array.isArray(input.zones)||input.zones.length>50||(input.enabled&&!input.zones.length))throw new Error('invalid_policy');
 const ids=new Set(),names=new Set();
 const zones=input.zones.map(zone=>{
  if(!keys(zone,['id','name','fee_cents','eta_min','eta_max','free_from_cents'])||typeof zone.id!=='string'||!/^[-a-zA-Z0-9_]{8,80}$/.test(zone.id)||ids.has(zone.id)||typeof zone.name!=='string')throw new Error('invalid_zone');
  const name=zone.name.trim().replace(/\s+/g,' '),key=name.normalize('NFKC').toLowerCase();
  if(!name||name.length>80||/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/.test(name)||names.has(key)||!cents(zone.fee_cents)||!Number.isInteger(zone.eta_min)||!Number.isInteger(zone.eta_max)||zone.eta_min<1||zone.eta_max<zone.eta_min||zone.eta_max>1440||!(zone.free_from_cents===null||cents(zone.free_from_cents)&&zone.free_from_cents>0))throw new Error('invalid_zone');
  ids.add(zone.id);names.add(key);return {id:zone.id,name,fee_cents:zone.fee_cents,eta_min:zone.eta_min,eta_max:zone.eta_max,free_from_cents:zone.free_from_cents};
 });
 return {enabled:input.enabled,zones};
}
export function deliveryQuote(policy,zoneId,subtotalCents){
 if(!Number.isSafeInteger(subtotalCents)||subtotalCents<0)throw new Error('invalid_total');
 if(!policy.enabled)return {fee_cents:null,total_cents:subtotalCents,zone:null};
 const zone=policy.zones.find(zone=>zone.id===zoneId);if(!zone)throw new Error('delivery_area_required');
 const fee=zone.free_from_cents!==null&&subtotalCents>=zone.free_from_cents?0:zone.fee_cents;
 return {fee_cents:fee,total_cents:subtotalCents+fee,zone};
}
