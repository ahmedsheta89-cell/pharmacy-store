import {useEffect,useId,useRef,useState} from 'react';
import {compressProductPhoto} from '../lib/productPhotos';
import {uploadProductPhoto} from '../lib/firebase';

type Props={value:string;onChange:(url:string)=>void;onPendingChange:(pending:boolean)=>void;disabled?:boolean};
type Ready={blob:Blob;url:string;name:string};
export default function ProductPhotoField({value,onChange,onPendingChange,disabled=false}:Props){
  const [ready,setReady]=useState<Ready|null>(null);
  const [phase,setPhase]=useState<'idle'|'preparing'|'uploading'>('idle');
  const [error,setError]=useState('');const [notice,setNotice]=useState('');const [previewFailed,setPreviewFailed]=useState(false);
  const inputId=useId();const inputRef=useRef<HTMLInputElement|null>(null);const generation=useRef(0);const controller=useRef<AbortController|null>(null);
  const working=phase!=='idle';
  useEffect(()=>{setPreviewFailed(false);},[value,ready?.url]);
  useEffect(()=>{onPendingChange(working||!!ready);},[working,ready,onPendingChange]);
  useEffect(()=>()=>{generation.current++;controller.current?.abort();onPendingChange(false);},[onPendingChange]);
  useEffect(()=>()=>{if(ready)URL.revokeObjectURL(ready.url);},[ready]);
  async function select(file:File|undefined){
    if(!file)return;
    const current=++generation.current;
    setError('');setNotice('');setReady(null);setPhase('preparing');
    try{
      const blob=await compressProductPhoto(file);
      if(generation.current===current)setReady({blob,url:URL.createObjectURL(blob),name:file.name});
    }catch(e){if(generation.current===current)setError(e instanceof Error?e.message:'تعذر تجهيز الصورة.');}
    finally{if(generation.current===current)setPhase('idle');}
  }
  function discard(){generation.current++;controller.current?.abort();setReady(null);setPhase('idle');setError('');setNotice('');}
  async function upload(){
    if(!ready)return;
    const current=generation.current;const abort=new AbortController();controller.current=abort;
    setPhase('uploading');setError('');setNotice('');
    try{
      const url=await uploadProductPhoto(ready.blob,abort.signal);
      if(generation.current!==current)return;
      onChange(url);setReady(null);setNotice('تم رفع الصورة. احفظ المنتج لتثبيتها عليه.');
    }catch(e){if(generation.current===current&&!abort.signal.aborted)setError(e instanceof Error?e.message:'تعذر رفع الصورة.');}
    finally{if(generation.current===current)setPhase('idle');}
  }
  return <section aria-label="صورة المنتج" className="mt-5 overflow-hidden rounded-2xl border border-brand-100 bg-brand-50/40">
    <div className="border-b border-brand-100 px-4 py-3"><h3 className="text-sm font-black text-brand-950">صورة المنتج</h3><p className="mt-1 text-xs leading-6 text-slate-600">اختيار، معاينة، ثم رفع. العبوة تظهر كاملة بدون قص أو تغيير بياناتها.</p></div>
    <div className="space-y-3 p-4">
      {(ready||value)&&<div className="rounded-xl border border-brand-100 bg-white p-3">{previewFailed?<div className="rounded-lg bg-slate-50 p-3 text-center"><p className="text-xs leading-6 text-slate-600">تعذر تحميل المعاينة. لو الصورة مرفوعة حالًا، قد يحتاج ظهورها من بعض الأماكن دقيقة أو أكثر.</p><button type="button" onClick={()=>setPreviewFailed(false)} className="mt-2 min-h-11 rounded-lg border border-brand-100 bg-white px-3 py-2 text-xs font-bold text-brand-800">إعادة تحميل المعاينة</button></div>:<img src={ready?.url||value} alt={ready?'معاينة الصورة قبل الرفع':'الصورة الحالية للمنتج'} onError={()=>setPreviewFailed(true)} className="mx-auto h-44 max-w-full object-contain"/>}<p className="mt-2 text-center text-xs text-slate-500">{ready?'معاينة فقط، لم تُرفع بعد.':'الصورة المختارة للمنتج.'}</p></div>}
      <label htmlFor={inputId} className="block text-xs font-bold text-brand-950">اختر صورة من الموبايل أو الكمبيوتر</label>
      <input ref={inputRef} id={inputId} type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled||working} onChange={e=>{void select(e.target.files?.[0]);e.target.value='';}} className="hidden"/>
      <button type="button" disabled={disabled||working} onClick={()=>inputRef.current?.click()} className="min-h-11 w-full rounded-xl border border-brand-200 bg-white px-4 py-3 text-sm font-bold text-brand-800 transition-colors hover:bg-brand-50 disabled:cursor-wait disabled:opacity-50">{phase==='preparing'?'جارٍ تجهيز الصورة...':ready||value?'اختيار صورة أخرى':'اختيار صورة من الجهاز'}</button>
      <p className="text-xs leading-6 text-slate-500">JPG أو PNG أو WebP حتى 15 ميجابايت. تُصغّر إلى 1200 بكسل كحد أقصى وتُضغط حتى 200 كيلوبايت، مع إزالة بيانات الموقع المضمنة. الصور المتحركة تصبح صورة ثابتة.</p>
      <p className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs leading-6 text-amber-900">للمنتجات فقط. الصورة المرفوعة متاحة برابطها؛ لا ترفع روشتة أو صورة عميل أو مستندًا خاصًا.</p>
      {ready&&<div><p className="mb-2 break-all text-xs text-slate-500">{ready.name} · {Math.ceil(ready.blob.size/1024)} كيلوبايت</p><div className="flex flex-wrap gap-2"><button type="button" disabled={disabled||working} onClick={()=>void upload()} className="min-h-11 flex-1 rounded-xl bg-brand-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{phase==='uploading'?'جارٍ الرفع...':'رفع الصورة'}</button><button type="button" disabled={disabled} onClick={discard} className="min-h-11 rounded-xl border border-brand-100 bg-white px-4 py-2 text-sm font-bold text-slate-600">استبعاد</button></div><p className="mt-2 text-xs leading-6 text-slate-500">ارفع الصورة أو استبعدها قبل حفظ المنتج. رفعها وحده لا ينشر المنتج للعملاء.</p></div>}
      {phase==='preparing'&&<p role="status" className="text-sm text-brand-800">جارٍ تجهيز الصورة وضغطها...</p>}
      {error&&<p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs leading-6 text-red-700">{error} {value?'الصورة السابقة لم تتغير.':'لم تُربط أي صورة بالمنتج.'}</p>}
      {notice&&<p role="status" className="rounded-xl bg-brand-100 px-3 py-2 text-xs leading-6 text-brand-900">{notice}</p>}
      <details className="rounded-xl border border-brand-100 bg-white px-3"><summary className="min-h-11 cursor-pointer py-3 text-xs font-bold text-slate-600">استخدام رابط صورة بدل الرفع</summary><label className="block pb-3 text-xs text-slate-500">رابط HTTPS للصورة<input type="url" dir="ltr" value={value} disabled={disabled||working||!!ready} onChange={e=>{setError('');setNotice('');onChange(e.target.value);}} placeholder="https://" className="mt-2 w-full min-w-0 rounded-lg border border-brand-100 px-3 py-2.5 text-left text-sm"/></label></details>
    </div>
  </section>;
}
