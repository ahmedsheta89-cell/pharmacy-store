export const PHOTO_MAX_BYTES=200*1024;
export const PHOTO_MAX_EDGE=1200;
export const PHOTO_ORIGIN='https://oneforallgood-assistant.oneforallgood-store.workers.dev';
export const photoUrl=id=>PHOTO_ORIGIN+'/media/'+id;
const validId=id=>/^[a-f0-9]{64}$/.test(id||'');
const imageResponse=bytes=>new Response(bytes,{headers:{'Content-Type':'image/jpeg','Cache-Control':'public,max-age=86400,immutable','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox",'Access-Control-Allow-Origin':'*'}});
export function jpegDimensions(bytes){
 if(bytes.length<12||bytes[0]!==255||bytes[1]!==216||bytes.at(-2)!==255||bytes.at(-1)!==217)return null;
 let i=2;let dimensions=null;
 while(i+3<bytes.length){
  if(bytes[i++]!==255)return null;while(bytes[i]===255)i++;
  const marker=bytes[i++];if(marker===0xd9)return null;
  if(marker===0x01||(marker>=0xd0&&marker<=0xd7))continue;
  if(i+2>bytes.length)return null;const length=(bytes[i]<<8)|bytes[i+1];
  if(length<2||i+length>bytes.length)return null;
  if([0xc0,0xc1,0xc2].includes(marker)){
   if(length<11||bytes[i+2]!==8||![1,3,4].includes(bytes[i+7])||length!==8+3*bytes[i+7])return null;
   const height=(bytes[i+3]<<8)|bytes[i+4],width=(bytes[i+5]<<8)|bytes[i+6];
   if(!width||!height)return null;dimensions={width,height};
  }
  if(marker===0xda)return dimensions&&length>=8&&i+length<bytes.length-2?dimensions:null;
  i+=length;
 }
 return null;
}
async function boundedBody(request){
 if(Number(request.headers.get('Content-Length'))>PHOTO_MAX_BYTES)return null;
 const reader=request.body?.getReader();if(!reader)return null;const parts=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>PHOTO_MAX_BYTES){await reader.cancel();return null;}parts.push(value);}
 const result=new Uint8Array(size);let offset=0;for(const p of parts){result.set(p,offset);offset+=p.length;}return result;
}
export async function uploadPhoto(request,env){
 // Missing rate limiter or storage fails closed instead of exposing a write API.
 if(!env.PRODUCT_PHOTOS||!env.PHOTO_LIMITER)return {status:503,body:{error:'photo_storage_unavailable'}};
 try{
  const ip=request.headers.get('CF-Connecting-IP')||'unknown';
  if(!(await env.PHOTO_LIMITER.limit({key:'ip:'+ip})).success)return {status:429,body:{error:'photo_rate_limited'}};
  const token=request.headers.get('Authorization')?.match(/^Bearer ([^\s]{1,10000})$/)?.[1];
  if(!token)return {status:401,body:{error:'auth_required'}};
  const auth=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=AIzaSyCsRvLEcaGr1DV6a6HFHmR4Xe9mzqgpApQ',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:token})});
  const identity=await auth.json();
  if(!auth.ok||identity.users?.[0]?.email!=='ahmedsheta89@gmail.com'||identity.users[0].disabled)return {status:403,body:{error:'manager_only'}};
  if(!(await env.PHOTO_LIMITER.limit({key:'owner:'+identity.users[0].localId})).success)return {status:429,body:{error:'photo_rate_limited'}};
  if(request.headers.get('Content-Type')?.split(';')[0].trim()!=='image/jpeg')return {status:415,body:{error:'jpeg_required'}};
  const bytes=await boundedBody(request);if(!bytes)return {status:413,body:{error:'photo_too_large'}};
  const dimensions=jpegDimensions(bytes);
  if(!dimensions||dimensions.width>PHOTO_MAX_EDGE||dimensions.height>PHOTO_MAX_EDGE)return {status:400,body:{error:'invalid_photo'}};
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
  const key='image:'+hash;
  if(!await env.PRODUCT_PHOTOS.get(key,{type:'arrayBuffer'}))await env.PRODUCT_PHOTOS.put(key,bytes,{metadata:{created_at:Date.now(),size:bytes.length,...dimensions}});
  // KV is eventually consistent. Warm this edge from the verified upload bytes
  // rather than relying on an immediate KV read for the owner's first preview.
  try{if(globalThis.caches?.default)await globalThis.caches.default.put(new Request(photoUrl(hash)),imageResponse(bytes));}catch{}
  return {status:201,body:{ok:true,url:photoUrl(hash),bytes:bytes.length,...dimensions}};
 }catch{return {status:503,body:{error:'photo_storage_unavailable'}};}
}
export async function servePhoto(id,env,ctx){
 const missing=()=>new Response('Not found',{status:404,headers:{'Cache-Control':'no-store'}});
 if(!validId(id)||!env.PRODUCT_PHOTOS)return missing();
 try{
  // Immutable content hashes share a canonical edge-cache key, even with queries.
  const cache=globalThis.caches?.default;const key=new Request(photoUrl(id));
  if(cache){try{const hit=await cache.match(key);if(hit)return hit;}catch{}}
  const bytes=await env.PRODUCT_PHOTOS.get('image:'+id,{type:'arrayBuffer'});if(!bytes)return missing();
  const response=imageResponse(bytes);
  if(cache&&ctx){try{ctx.waitUntil(Promise.resolve(cache.put(key,response.clone())).catch(()=>{}));}catch{}}
  return response;
 }catch{return new Response('Image temporarily unavailable',{status:503,headers:{'Cache-Control':'no-store'}});}
}
// No automatic cross-database deletion. A reference-query/delete race could
// erase a newly linked photo. Free storage exhaustion fails uploads safely;
// old images remain available. A future cleanup needs an explicit safe workflow.
