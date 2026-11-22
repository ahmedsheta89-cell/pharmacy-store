import {productPhotoIdentity,type PhotoCatalogItem,type PhotoMatch} from './productPhotoMatching.ts';
export type PhotoQueuePhase='queued'|'preparing'|'ready'|'uploading'|'saving'|'done'|'error'|'invalid'|'skipped';
export type PhotoSelection={key:string;phase:PhotoQueuePhase;prepared:boolean;productId:string;expectedIdentity:string;expectedImageUrl:string;expectedImageRevision?:string;manual:boolean;identityConfirmed:boolean;replacementConfirmed:boolean;uploadedUrl?:string;match:PhotoMatch};
export type PhotoSelectionState={product?:PhotoCatalogItem;stale:boolean;duplicate:boolean;needsIdentityReview:boolean;needsReplacementReview:boolean;eligible:boolean;reason:'ready'|'phase'|'select'|'deleted'|'stale'|'duplicate'|'identity_review'|'replacement_review'};
export const PHOTO_BATCH_LIMIT=50,PHOTO_BATCH_BYTES=250*1024*1024;
export function validatePhotoBatch(files:readonly {size:number}[]):string|null{
 if(!files.length)return 'اختر صورة واحدة على الأقل.';
 if(files.length>PHOTO_BATCH_LIMIT||files.reduce((n,f)=>n+f.size,0)>PHOTO_BATCH_BYTES)return 'قسّم الصور إلى دفعات حتى 50 صورة وإجمالي 250 ميجابايت. لم يُرفع أي ملف.';
 return null;
}
export function photoTargetCounts(rows:readonly PhotoSelection[]):Map<string,number>{
 const counts=new Map<string,number>();
 for(const row of rows)if(row.prepared&&row.productId&&!['skipped','invalid'].includes(row.phase))counts.set(row.productId,(counts.get(row.productId)||0)+1);
 return counts;
}
export function photoSelectionState(row:PhotoSelection,products:readonly PhotoCatalogItem[],counts:Map<string,number>):PhotoSelectionState{
 const product=products.find(p=>p.id===row.productId);
 const currentUrl=product?.imageUrl?.trim()||'';
 const stale=!!product&&(productPhotoIdentity(product)!==row.expectedIdentity||(currentUrl!==row.uploadedUrl&&(currentUrl!==row.expectedImageUrl||(product.image_revision||'')!==(row.expectedImageRevision||''))));
 const duplicate=(counts.get(row.productId)||0)>1;
 const needsIdentityReview=row.manual||row.match.kind!=='exact_id';
 const needsReplacementReview=!!row.expectedImageUrl;
 let reason:PhotoSelectionState['reason']='ready';
 if(!row.prepared||!['ready','error'].includes(row.phase))reason='phase';
 else if(!row.productId)reason='select';
 else if(!product)reason='deleted';
 else if(stale)reason='stale';
 else if(duplicate)reason='duplicate';
 else if(needsIdentityReview&&!row.identityConfirmed)reason='identity_review';
 else if(needsReplacementReview&&!row.replacementConfirmed)reason='replacement_review';
 return {product,stale,duplicate,needsIdentityReview,needsReplacementReview,eligible:reason==='ready',reason};
}
