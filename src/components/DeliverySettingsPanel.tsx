import {useEffect,useState} from 'react';
import {readDeliveryPolicy,saveDeliveryPolicy} from '../lib/firebase';
import {validateDeliveryPolicy,type DeliveryPolicy,type DeliveryZone} from '../../shared/deliveryPolicy.js';

type Row={id:string;name:string;fee:string;min:string;max:string;free:string};
const input='mt-1 w-full rounded-xl border border-brand-100 bg-white px-3 py-2.5 text-sm text-brand-950';
const digits=(value:string)=>value.trim().replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-0x660)).replace(/٫/g,'.');
function money(value:string){const text=digits(value);if(!/^\d+(\.\d{1,2})?$/.test(text))throw new Error('اكتب الرسوم والحد المجاني كرقم صحيح أو بمنزلتين عشريتين، من غير فواصل آلاف.');return Math.round(Number(text)*100);}
function minutes(value:string){const text=digits(value);if(!/^\d+$/.test(text))throw new Error('مدة التوصيل لازم تكون عدد دقائق صحيح.');return Number(text);}
const row=(zone:DeliveryZone):Row=>({id:zone.id,name:zone.name,fee:String(zone.fee_cents/100),min:String(zone.eta_min),max:String(zone.eta_max),free:zone.free_from_cents===null?'':String(zone.free_from_cents/100)});
export default function DeliverySettingsPanel(){
 const [saved,setSaved]=useState<DeliveryPolicy|null>(null),[rows,setRows]=useState<Row[]>([]),[enabled,setEnabled]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function load(){setBusy(true);setError('');setNotice('');try{const policy=await readDeliveryPolicy(true);setSaved(policy);setRows(policy.zones.map(row));setEnabled(policy.enabled);}catch(error){setError(error instanceof Error?error.message:'تعذر تحميل الإعدادات.');}finally{setBusy(false);}}
 useEffect(()=>{void load()},[]);
 const update=(id:string,values:Partial<Row>)=>setRows(old=>old.map(row=>row.id===id?{...row,...values}:row));
 async function save(event:React.FormEvent){event.preventDefault();if(busy||!saved)return;setError('');setNotice('');try{
  const clean=validateDeliveryPolicy({enabled,zones:rows.map(zone=>({id:zone.id,name:zone.name,fee_cents:money(zone.fee),eta_min:minutes(zone.min),eta_max:minutes(zone.max),free_from_cents:zone.free.trim()?money(zone.free):null}))});
  setBusy(true);const policy=await saveDeliveryPolicy(clean,saved.version);setSaved(policy);setRows(policy.zones.map(row));setEnabled(policy.enabled);setNotice(policy.enabled?'اتحفظت واتفعّلت سياسة التوصيل. الطلبات القديمة لم تتغير.':'اتحفظت الإعدادات والسياسة غير مفعّلة. رسوم التوصيل تتأكد مع الصيدلية كالمعتاد.');
 }catch(error){const message=error instanceof Error?error.message:'';setError(message==='invalid_policy'||message==='invalid_zone'?'راجع البيانات: أسماء المناطق مختلفة، والرسوم غير سالبة، والمدة من دقيقة إلى ١٤٤٠ دقيقة وبترتيب صحيح. التفعيل يحتاج منطقة واحدة على الأقل.':message||'تعذر تأكيد الحفظ. أعد تحميل الإعدادات قبل المحاولة.');}finally{setBusy(false);}}
 return <section className="rounded-2xl border border-brand-100 bg-white p-4 shadow-sm sm:p-6" aria-label="إعدادات التوصيل">
  <h2 className="text-xl font-black text-brand-950">مناطق ورسوم التوصيل</h2>
  <p className="mt-2 text-sm leading-7 text-slate-600">ضيف المناطق والرسوم والمدة اللي تقدر تلتزم بها. مفيش أرقام مفروضة عليك، ومفيش تغيير يظهر للعميل قبل الحفظ. المدد بعد تأكيد الطلب وتوفر الأصناف، وليست وعدًا بتوصيل فوري.</p>
  <p role="status" className="mt-3 rounded-xl bg-brand-50 p-3 text-sm font-bold text-brand-950">{saved?saved.enabled?'السياسة المحفوظة مفعّلة للعملاء.':'السياسة المحفوظة غير مفعّلة. التوصيل يتأكد مع الصيدلية.':'جارٍ التحقق من الإعدادات المحفوظة...'}</p>
  {error&&<p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
  {notice&&<p role="status" className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-900">{notice}</p>}
  <button type="button" disabled={busy} onClick={()=>{if(!saved||window.confirm('إعادة التحميل هتستبدل أي تعديلات لم تحفظها. تكمل؟'))void load()}} className="mt-3 rounded-xl border border-brand-100 px-4 py-2 text-sm font-bold text-brand-700 disabled:opacity-50">إعادة تحميل الإعدادات</button>
  <form onSubmit={save} className="mt-5">
   <fieldset disabled={busy||!saved} className="space-y-4">
    <label className="flex items-start gap-3 rounded-xl border border-brand-100 p-3 text-sm font-bold text-brand-950"><input type="checkbox" checked={enabled} onChange={event=>setEnabled(event.target.checked)} className="mt-1"/><span>تفعيل السياسة عند الحفظ<span className="mt-1 block text-xs font-normal leading-6 text-slate-500">لو مقفولة، العميل يكمل بالنظام الحالي وتكلفة التوصيل تتأكد مع الصيدلية. إيقافها لا يغير رسوم أي طلب قديم.</span></span></label>
    {rows.map((zone,index)=><fieldset key={zone.id} className="rounded-2xl border border-brand-100 p-3 sm:p-4">
     <legend className="px-1 text-sm font-black text-brand-950">منطقة {index+1}</legend>
     <label className="block text-sm font-bold">اسم المنطقة للعميل<input required maxLength={80} value={zone.name} onChange={event=>update(zone.id,{name:event.target.value})} className={input}/></label>
     <div className="mt-3 grid gap-3 sm:grid-cols-3">
      <label className="block text-sm font-bold">رسوم التوصيل بالجنيه<input required inputMode="decimal" dir="ltr" value={zone.fee} onChange={event=>update(zone.id,{fee:event.target.value})} className={input}/></label>
      <label className="block text-sm font-bold">المدة من، بالدقائق<input required inputMode="numeric" dir="ltr" value={zone.min} onChange={event=>update(zone.id,{min:event.target.value})} className={input}/></label>
      <label className="block text-sm font-bold">المدة إلى، بالدقائق<input required inputMode="numeric" dir="ltr" value={zone.max} onChange={event=>update(zone.id,{max:event.target.value})} className={input}/></label>
     </div>
     <label className="mt-3 block text-sm font-bold">توصيل مجاني من قيمة منتجات، اختياري<input inputMode="decimal" dir="ltr" value={zone.free} onChange={event=>update(zone.id,{free:event.target.value})} className={input}/><span className="mt-1 block text-xs font-normal leading-6 text-slate-500">بالجنيه لهذه المنطقة فقط. اتركه فارغًا لإيقاف المجاني. الصيدلية تتحمل تكلفة التوصيل الفعلية عند تفعيله.</span></label>
     <button type="button" onClick={()=>setRows(old=>old.filter(row=>row.id!==zone.id))} className="mt-3 rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-700">حذف هذه المنطقة</button>
    </fieldset>)}
    {!rows.length&&<p className="rounded-xl bg-brand-50 p-4 text-sm text-brand-950">لم تضف مناطق بعد. أضف منطقة واكتب رسومها ومدتها قبل التفعيل.</p>}
    <button type="button" disabled={rows.length>=50} onClick={()=>setRows(old=>[...old,{id:crypto.randomUUID(),name:'',fee:'',min:'',max:'',free:''}])} className="rounded-xl border border-brand-100 px-4 py-2.5 text-sm font-bold text-brand-700">إضافة منطقة توصيل</button>
    <p className="text-xs leading-6 text-slate-500">العميل يختار من القائمة ويكتب عنوانه. راجع تطابق العنوان والمنطقة قبل إرسال المندوب. أي منطقة غير مدرجة تحتاج تواصلًا، ولا نعتبر رسومها صفرًا.</p>
    <button type="submit" className="block w-full rounded-xl bg-brand-700 px-5 py-3 font-bold text-white disabled:opacity-50">{busy?'جارٍ تأكيد الحفظ...':enabled?'حفظ وتفعيل سياسة التوصيل':'حفظ بدون تفعيل سياسة التوصيل'}</button>
   </fieldset>
  </form>
 </section>;
}
