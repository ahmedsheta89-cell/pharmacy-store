// Shared Firestore REST helpers for the oneforallgood-assistant Worker, plus the
// store interface the CRM handlers are written against (see worker/lib/util.js
// for pure helpers and worker/test/memory-store.js for the test double).

import { sha256hex } from './util.js';

const PROJECT = 'one-for-all-good';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
export const DOC_NAME = `projects/${PROJECT}/databases/(default)/documents`;

const enc = new TextEncoder();
const b64 = (v) => btoa(String.fromCharCode(...new Uint8Array(v))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const j64 = (v) => b64(enc.encode(JSON.stringify(v)));

let cached;
export async function access(env) {
  if (cached?.until > Date.now()) return cached.token;
  const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT), now = Math.floor(Date.now() / 1000);
  const input = j64({ alg: 'RS256', typ: 'JWT' }) + '.' + j64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/datastore', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
  const pem = Uint8Array.from(atob(sa.private_key.replace(/-----[^-]+-----|\s/g, '')), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', pem, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(input));
  env.CRM_IO_BUDGET?.charge();
  const r = await fetch('https://oauth2.googleapis.com/token', { signal:AbortSignal.timeout(5000), method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: input + '.' + b64(signature) }) });
  const data = await r.json();
  if (!r.ok || !data.access_token) throw new Error('backend_auth_unavailable');
  cached = { token: data.access_token, until: Date.now() + 3300000 };
  return cached.token;
}

export function val(v) {
  if (v === null) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(val) } };
  return { mapValue: { fields: fields(v) } };
}
export function fields(o) {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined).map(([k, v]) => [k, val(v)]));
}
function decode(v) {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if (v.arrayValue) return (v.arrayValue.values || []).map(decode);
  if (v.mapValue) return object(v.mapValue.fields || {});
  if (v.timestampValue) return v.timestampValue;
  return null;
}
export function object(f) {
  return Object.fromEntries(Object.entries(f || {}).map(([k, v]) => [k, decode(v)]));
}

export async function db(env, path, method = 'GET', body) {
  env.CRM_IO_BUDGET?.charge();
  const r = await fetch(BASE + path, { signal:AbortSignal.timeout(5000), method, headers: { Authorization: 'Bearer ' + (await access(env)), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await r.json();
  if (!r.ok) { const e = new Error(data.error?.status || 'database_unavailable'); e.status = r.status; throw e; }
  return data;
}

export async function getDoc(env, path) {
  try { const d = await db(env, '/' + path); return { data: object(d.fields), updateTime: d.updateTime }; }
  catch (e) { if (e.status === 404) return null; throw e; }
}

export async function runQuery(env, structuredQuery, parent = '') {
  const rows = await db(env, `${parent}:runQuery`, 'POST', { structuredQuery });
  return rows.filter((x) => x.document).map((x) => ({ id: x.document.name.split('/').pop(), data: object(x.document.fields), updateTime: x.document.updateTime }));
}

// Version-checked atomic writes, with read guards included as verify writes.
export function firestoreStore(env, transport = db) {
  return {
    get: path => getDoc(env, path),
    async commit(writes, reads) {
      const touched = new Set(writes.map(w => w.path));
      const pre = path => reads.get(path) ? {updateTime: reads.get(path).updateTime} : {exists:false};
      const ops = writes.map(w => ({update:{name:DOC_NAME+'/'+w.path,fields:fields(w.data)},currentDocument:pre(w.path)}));
      for (const [path] of reads) if (!touched.has(path)) ops.push({verify:DOC_NAME+'/'+path,currentDocument:pre(path)});
      await transport(env, ':commit', 'POST', {writes:ops});
    },
    // Use sequence numbers, not timestamps: no equal-timestamp gaps or stuck pages.
    listMessagesAfter(convId, after, pageSize) {
      return runQuery(env, {
        from:[{collectionId:'messages'}],
        where:{fieldFilter:{field:{fieldPath:'seq'},op:'GREATER_THAN',value:val(after || 0)}},
        orderBy:[{field:{fieldPath:'seq'},direction:'ASCENDING'}],limit:pageSize,
      }, '/conversations/'+convId);
    },
    listRecentMessages(convId, pageSize) {
      return runQuery(env, {from:[{collectionId:'messages'}],orderBy:[{field:{fieldPath:'seq'},direction:'DESCENDING'}],limit:pageSize}, '/conversations/'+convId);
    },
    async listConversationIds(after = '', pageSize = 20) {
      const q = {from:[{collectionId:'conversations'}],orderBy:[{field:{fieldPath:'__name__'},direction:'ASCENDING'}],limit:pageSize};
      if(after) q.startAt = {values:[{referenceValue:DOC_NAME+'/conversations/'+after}],before:false};
      return runQuery(env,q);
    },
  };
}
export { sha256hex };
