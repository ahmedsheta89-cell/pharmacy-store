export type PhotoCatalogItem={id:string;name?:string;nameEn?:string;unit?:string;category?:string;imageUrl?:string};
export type PhotoMatch={fileIndex:number;filename:string;kind:'exact_id'|'review'|'unmatched';productId?:string;candidateIds:string[];reason:'exact_id'|'catalog_code_collision'|'duplicate_target'|'name_hint'|'no_match'|'unsafe_filename'|'unknown_extension'};

// Catalog imports currently map SKU/barcode to the document ID. Do not guess a
// missing barcode, remove strength/pack numbers, or use a name hint as approval.
const codeKey=(value:string)=>value.trim().toLowerCase();
const unsafeName=/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069/\\]/;
const extension=/\.(jpe?g|png|webp)$/i;
const readable=(value:string)=>value.normalize('NFKD').replace(/\p{M}/gu,'').replace(/ـ/g,'').replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();

export function photoFilenameDisplay(value:string):string{
 return value.replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g,'�').slice(0,255);
}
export function productPhotoIdentity(product:PhotoCatalogItem):string{
 return JSON.stringify([product.id,product.name||'',product.nameEn||'',product.unit||'',product.category||'']);
}
export function isStoredProductPhotoUrl(value:string):boolean{
 return /^https:\/\/oneforallgood-assistant\.oneforallgood-store\.workers\.dev\/media\/[a-f0-9]{64}$/.test(value);
}
function nameHintScore(stem:string,product:PhotoCatalogItem):number{
 const query=readable(stem);if(!query)return 0;
 const words=new Set(query.split(' '));const numbers:string[]=query.match(/\d+/g)||[];
 return Math.max(0,...[product.name,product.nameEn].filter((x):x is string=>!!x).map(name=>{
  const text=readable(name);if(text===query)return 1;
  const nameNumbers:string[]=text.match(/\d+/g)||[];
  if(numbers.some(n=>!nameNumbers.includes(n)))return 0;
  const tokens=new Set(text.split(' '));const common=[...words].filter(w=>tokens.has(w));
  // Numeric coincidence alone must not suggest an unrelated pack.
  if(!common.some(w=>/\p{L}/u.test(w)&&w.length>=2))return 0;
  return common.length/Math.max(words.size,tokens.size);
 }));
}
export function matchProductPhotoFilenames(filenames:readonly string[],products:readonly PhotoCatalogItem[]):PhotoMatch[]{
 const codes=new Map<string,PhotoCatalogItem[]>();
 for(const p of products){const key=codeKey(p.id);if(key)codes.set(key,[...(codes.get(key)||[]),p]);}
 const result=filenames.map((filename,fileIndex):PhotoMatch=>{
  const base={fileIndex,filename,candidateIds:[] as string[]};
  if(filename.length>255||unsafeName.test(filename))return {...base,kind:'review',reason:'unsafe_filename'};
  if(!extension.test(filename))return {...base,kind:'unmatched',reason:'unknown_extension'};
  const stem=filename.replace(extension,'').trim();const exact=codes.get(codeKey(stem))||[];
  if(exact.length===1)return {...base,kind:'exact_id',productId:exact[0].id,candidateIds:[exact[0].id],reason:'exact_id'};
  if(exact.length>1)return {...base,kind:'review',candidateIds:[...new Set(exact.map(p=>p.id))],reason:'catalog_code_collision'};
  const hints=products.map(p=>({id:p.id,score:nameHintScore(stem,p)})).filter(p=>p.score>=.4).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id)).slice(0,5);
  return {...base,kind:hints.length?'review':'unmatched',candidateIds:[...new Set(hints.map(p=>p.id))],reason:hints.length?'name_hint':'no_match'};
 });
 const targets=new Map<string,PhotoMatch[]>();
 for(const row of result)if(row.productId)targets.set(row.productId,[...(targets.get(row.productId)||[]),row]);
 for(const rows of targets.values())if(rows.length>1)for(const row of rows){row.kind='review';row.reason='duplicate_target';delete row.productId;}
 return result;
}
