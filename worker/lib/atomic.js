// Each request gets at most two optimistic attempts. Read-only authorization
// units also commit verify guards, so revocation racing the operation conflicts.
export async function atomic(store,fn) {
  for(let attempt=0;attempt<2;attempt++) {
    const reads=new Map(),writes=[];
    const tx={async get(path){if(!reads.has(path))reads.set(path,await store.get(path));return structuredClone(reads.get(path)?.data??null);},set(path,data){writes.push({path,data});}};
    const result=await fn(tx);
    if(writes.some(w=>!reads.has(w.path)))throw new Error('write_without_read');
    if(!reads.size)return result;
    try{await store.commit(writes,reads);return result;}
    catch(e){if(![409,412].includes(e.status))throw e;if(attempt===1)throw Object.assign(new Error('contention_retry_later'),{status:503});}
  }
}
