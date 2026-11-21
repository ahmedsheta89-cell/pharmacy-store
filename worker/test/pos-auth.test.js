import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {SignJWT,importPKCS8} from 'jose';
import {verifyPosToken} from '../pos-auth.js';
test('Firebase token signature, exact audience/issuer/uid/time/current-account checks',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'pos-auth-test-'));
 try{
  execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-subj','/CN=synthetic-unit-test','-keyout',join(dir,'key.pem'),'-out',join(dir,'cert.pem'),'-days','1'],{stdio:'ignore'});
  const key=await importPKCS8(readFileSync(join(dir,'key.pem'),'utf8'),'RS256'),cert=readFileSync(join(dir,'cert.pem'),'utf8'),now=Math.floor(Date.now()/1000);
  const claims={sub:'uid1',aud:'one-for-all-good',iss:'https://securetoken.google.com/one-for-all-good',iat:now-10,auth_time:now-20,exp:now+3500};
  let account={localId:'uid1',validSince:String(now-30)},calls=[];
  const fetcher=async(url,options)=>{calls.push({url,options});return url.includes('/x509/')?new Response(JSON.stringify({'test-key':cert}),{headers:{'Cache-Control':'max-age=100'}}):new Response(JSON.stringify({users:[account]}));};
  const sign=(change={},head={})=>new SignJWT({...claims,...change}).setProtectedHeader({alg:'RS256',kid:'test-key',...head}).sign(key);
  assert.equal(await verifyPosToken(await sign(),fetcher),'uid1');
  assert(calls.every(c=>c.options.redirect==='error'));
  for(const change of [{aud:'wrong-project'},{aud:['one-for-all-good','other']},{iss:'https://attacker.example'},{exp:now-1},{iat:now+20},{auth_time:now+1},{sub:''},{exp:now+8000}])await assert.rejects(verifyPosToken(await sign(change),fetcher));
  await assert.rejects(verifyPosToken(await sign({}, {kid:'unknown'}),fetcher));
  const token=await sign();await assert.rejects(verifyPosToken(token.slice(0,-8)+'AAAAAAAA',fetcher));
  account={localId:'other'};await assert.rejects(verifyPosToken(token,fetcher));
  account={localId:'uid1',disabled:true};await assert.rejects(verifyPosToken(token,fetcher));
  account={localId:'uid1',validSince:String(now)};await assert.rejects(verifyPosToken(token,fetcher));
  await assert.rejects(verifyPosToken(token,async()=>{throw new Error('network');}),/auth_unavailable/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
