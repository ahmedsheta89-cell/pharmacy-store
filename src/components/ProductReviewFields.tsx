import type { StoreProduct } from '../lib/firebase';
import {reviewIssues,reviewToday,type ReviewIssue} from '../lib/productReview';
export const input='mt-1 block w-full rounded-xl border border-brand-100 bg-white p-3 text-sm';
function ReviewError({field,issues}:{field:ReviewIssue['field'];issues:ReviewIssue[]}){
 const issue=issues.find(item=>item.field===field);
 return issue?<p id={`review-error-${field}`} className="mt-1 text-xs leading-6 text-red-700">{issue.message}</p>:null;
}
export default function ProductReviewFields({product:p,onChange}:{product:StoreProduct;onChange:(p:StoreProduct)=>void}){
 const clinical=(key:keyof StoreProduct,value:string)=>onChange({...p,[key]:value,content_review_status:'unreviewed'});
 const reviewed=p.content_review_status==='reviewed',today=reviewToday(),issues=reviewIssues(p,today);
 const validation=(field:ReviewIssue['field'])=>({required:reviewed,'aria-invalid':issues.some(issue=>issue.field===field),'aria-describedby':issues.some(issue=>issue.field===field)?`review-error-${field}`:undefined});
 return <fieldset className="mt-5 space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
 <legend className="px-2 text-sm font-black">بطاقة المنتج والمراجعة قبل النشر</legend>
 <p className="text-xs leading-6">لا تضف جرعة أو تعليمات من التخمين. استخدم نشرة أو مصدر معتمد وراجعه كصيدلي. الاستيراد والكتالوج المبدئي لا يمنحان اعتمادًا تلقائيًا.</p>
 <p className="text-xs leading-6">لاعتماد المراجعة، يلزم المصدر واسم المراجع وتاريخ المراجعة الفعلية ونسخة البيانات. يمكنك حفظ منتج غير مراجع كمسودة، لكنه لن يظهر للعملاء.</p>
 {([['dosage_information','معلومات الجرعة من المصدر'],['usage_instructions','تعليمات الاستعمال'],['warnings','التحذيرات']] as const).map(([key,label])=><label key={key} className="block text-xs font-bold">{label}<textarea rows={3} maxLength={4000} className={input} value={p[key]||''} onChange={e=>clinical(key,e.target.value)}/></label>)}
 <div><label className="block text-xs font-bold">المصدر أو مرجع النشرة<input {...validation('content_source')} maxLength={1000} className={input} value={p.content_source||''} onChange={e=>onChange({...p,content_source:e.target.value})}/></label><ReviewError field="content_source" issues={issues}/></div>
 <div><label className="block text-xs font-bold">اسم المراجع<input {...validation('content_reviewer')} maxLength={100} className={input} value={p.content_reviewer||''} onChange={e=>onChange({...p,content_reviewer:e.target.value})}/></label><ReviewError field="content_reviewer" issues={issues}/></div>
 <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
 <div><label className="block text-xs font-bold">تاريخ المراجعة<input {...validation('content_reviewed_at')} type="date" max={reviewed?today:undefined} className={`${input} min-w-0 max-w-full`} value={p.content_reviewed_at||''} onChange={e=>onChange({...p,content_reviewed_at:e.target.value})}/></label><ReviewError field="content_reviewed_at" issues={issues}/></div>
 <div><label className="block text-xs font-bold">نسخة البيانات<input {...validation('content_version')} className={input} maxLength={60} value={p.content_version||''} onChange={e=>onChange({...p,content_version:e.target.value})}/></label><ReviewError field="content_version" issues={issues}/></div>
 </div>
 <label className="block text-xs font-bold">حالة مراجعة البيانات<select className={input} value={p.content_review_status||'unreviewed'} onChange={e=>onChange({...p,content_review_status:e.target.value as StoreProduct['content_review_status']})}><option value="unreviewed">غير مراجعة، لا تنشر</option><option value="reviewed">راجعتها وأتحمل مسؤولية صحتها</option></select></label>
 <p role="status" className={`rounded-lg p-2 text-xs leading-6 ${reviewed&&issues.length?'bg-red-50 text-red-800':'bg-white text-slate-700'}`}>{reviewed?(issues.length?'المراجعة غير مكتملة. صحح الحقول الموضحة قبل الحفظ.':'بيانات المراجعة مكتملة. راجع تصنيف الصرف والسماح بالإعلان أيضًا قبل النشر.'):'المنتج غير مراجع. الحفظ وحده لن ينشره للعملاء.'}</p>
 <label className="block text-xs font-bold">تصنيف الصرف<select className={input} value={p.prescription_status||'unknown'} onChange={e=>onChange({...p,prescription_status:e.target.value as StoreProduct['prescription_status']})}><option value="unknown">غير محدد، لا ينشر</option><option value="non_prescription">دواء لا يحتاج وصفة بعد التحقق</option><option value="prescription">دواء يحتاج وصفة، لا إعلان عام</option><option value="not_medicine">منتج غير دوائي بعد التحقق</option></select></label>
 <label className="block text-xs font-bold">مراجعة السماح بالإعلان<select className={input} value={p.advertising_status||'unreviewed'} onChange={e=>onChange({...p,advertising_status:e.target.value as StoreProduct['advertising_status']})}><option value="unreviewed">غير مراجعة، مخفي من العملاء</option><option value="approved">تحققت أنه مسموح بعرضه والإعلان عنه</option><option value="blocked">غير مسموح</option></select></label>
 <p className="text-xs leading-6">اختيار غير دوائي أو بدون وصفة وحده لا يعني السماح بالإعلان. التحقق من القواعد المحلية ومسؤولية الاعتماد عند الصيدلية. البيانات غير المعتمدة تظل خاصة بالإدارة.</p>
 <label className="block text-xs font-bold">كمية المخزون المسجلة (اختياري)<input type="number" min="0" step="1" className={input} value={p.stock_quantity??''} onChange={e=>onChange({...p,stock_quantity:e.target.value===''?undefined:Number(e.target.value)})}/></label><p className="text-xs leading-6">الكمية المسجلة ليست مزامنة مباشرة مع برنامج الصيدلية. أكد التوفر قبل تنفيذ الطلب.</p>
 </fieldset>;
}
