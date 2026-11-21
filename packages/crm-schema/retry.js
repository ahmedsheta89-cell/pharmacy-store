// Pending operations survive same-browser reload/restart until success or an
// explicit discard. Only SHA-256 fingerprints and UUIDs are stored, never bodies.
export const RETRY_KEY='ofag-crm-pending-v3';
export function pendingId(storage,fingerprint,makeId) {
 let rows;try{rows=JSON.parse(storage.getItem(RETRY_KEY)||'{}');}catch{throw new Error('pending_storage_corrupt');}
 if(!rows || typeof rows!=='object'||Array.isArray(rows))throw new Error('pending_storage_corrupt');
 if(rows[fingerprint])return rows[fingerprint];
 if(Object.keys(rows).length>=100)throw new Error('pending_queue_full');
 const id=makeId();rows[fingerprint]=id;storage.setItem(RETRY_KEY,JSON.stringify(rows));return id;
}
export function clearPending(storage,fingerprint) {
 const rows=JSON.parse(storage.getItem(RETRY_KEY)||'{}');delete rows[fingerprint];storage.setItem(RETRY_KEY,JSON.stringify(rows));
}
export async function fingerprint(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(b=>b.toString(16).padStart(2,'0')).join('');}
