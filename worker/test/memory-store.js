export class MemoryStore {
  constructor(){this.rows=new Map();this.version=0;this.failNext=false;}
  async get(path){return structuredClone(this.rows.get(path)||null);}
  seed(path,data){this.rows.set(path,{data:structuredClone(data),updateTime:String(++this.version)});}
  async commit(writes,reads){
    if(this.failNext){this.failNext=false;throw new Error('injected_commit_failure');}
    for(const [path,snap] of reads)if(this.rows.get(path)?.updateTime!==snap?.updateTime)throw Object.assign(new Error('conflict'),{status:409});
    for(const w of writes)this.seed(w.path,w.data);
  }
  async listMessagesAfter(id,after,n){return [...this.rows].filter(([p,r])=>p.startsWith(`conversations/${id}/messages/`)&&r.data.seq>after).sort((a,b)=>a[1].data.seq-b[1].data.seq).slice(0,n).map(([p,r])=>({id:p.split('/').pop(),...structuredClone(r)}));}
  async listRecentMessages(id,n){return (await this.listMessagesAfter(id,0,10000)).reverse().slice(0,n);}
  async listConversationIds(after,n){return [...this.rows].filter(([p])=>/^conversations\/[^/]+$/.test(p)&&p.split('/')[1]>after).sort().slice(0,n).map(([p,r])=>({id:p.split('/').pop(),...structuredClone(r)}));}
}
