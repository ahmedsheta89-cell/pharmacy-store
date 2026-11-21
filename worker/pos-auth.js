import {jwtVerify, importX509, decodeProtectedHeader} from 'jose';
const PROJECT='one-for-all-good';
const CERTS='https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
// Public project identifier, not a secret. Same Firebase project as the store client.
const safeFetch=async(fetcher,...args)=>{try{return await fetcher(...args);}catch{throw new Error('auth_unavailable');}};
const API_KEY='AIzaSyCsRvLEcaGr1DV6a6HFHmR4Xe9mzqgpApQ';
let certificates;
export async function verifyPosToken(token,fetcher=fetch){
 const now=Math.floor(Date.now()/1000),h=decodeProtectedHeader(token);
 if(h.alg!=='RS256'||typeof h.kid!=='string'||h.kid.length>200)throw new Error('invalid_token');
 if(!certificates||certificates.until<=now){
  const r=await safeFetch(fetcher,CERTS,{redirect:'error'});if(!r.ok)throw new Error('auth_unavailable');
  const keys=await r.json(),age=Math.min(3600,Number(r.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1]||60));
  certificates={keys,until:now+age};
 }
 const cert=certificates.keys[h.kid];if(typeof cert!=='string')throw new Error('invalid_token');
 const {payload:p}=await jwtVerify(token,await importX509(cert,'RS256'),{algorithms:['RS256'],audience:PROJECT,issuer:'https://securetoken.google.com/'+PROJECT,requiredClaims:['exp','iat','sub','auth_time'],clockTolerance:0});
 if(p.aud!==PROJECT||p.iss!=='https://securetoken.google.com/'+PROJECT||!Number.isInteger(p.exp)||p.exp<=p.iat||p.exp-p.iat>3600||typeof p.sub!=='string'||!p.sub.length||p.sub.length>128||!Number.isInteger(p.iat)||p.iat>now||!Number.isInteger(p.auth_time)||p.auth_time>now)throw new Error('invalid_token');
 // Current account lookup also rejects revoked/disabled sessions, not just a valid signature.
 const r=await safeFetch(fetcher,'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key='+API_KEY,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:token})});
 if(!r.ok)throw new Error(r.status>=500?'auth_unavailable':'invalid_token');
 const u=(await r.json()).users?.[0];if(!u||u.localId!==p.sub||u.disabled||(!Number.isFinite(Number(u.validSince||0))||Number(u.validSince||0)>p.auth_time))throw new Error('invalid_token');
 return p.sub;
}
