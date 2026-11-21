import { useEffect, useState } from "react";
import { setExpectedDelivery, setOrderStatus, type StoreOrder } from "../lib/firebase";
export const STATUS_LABEL: Record<StoreOrder["status"], string> = {new:"جديد",confirmed:"تم التأكيد",preparing:"جاري التجهيز",out_for_delivery:"خرج للتوصيل",delivered:"تم التوصيل",cancelled:"ملغي"};
function localInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso); return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
}
export default function OrderDeliveryPanel({order}: {order: StoreOrder}) {
  const [eta,setEta] = useState(localInput(order.expected_at));
  const [busy,setBusy] = useState(false); const [error,setError] = useState("");
  const [confirm,setConfirm] = useState<StoreOrder["status"] | null>(null);
  const [now,setNow] = useState(Date.now());
  useEffect(()=> { const t=setInterval(()=>setNow(Date.now()),60000); return ()=>clearInterval(t); },[]);
  useEffect(()=>setEta(localInput(order.expected_at)),[order.expected_at]);
  const active = !["delivered","cancelled"].includes(order.status);
  const late = active && !!order.expected_at && Date.parse(order.expected_at)<now;
  const transitions: Partial<Record<StoreOrder["status"], StoreOrder["status"][]>> = {new:["confirmed"],confirmed:["preparing","out_for_delivery"],preparing:["out_for_delivery"],out_for_delivery:["delivered"]};
  async function update(status: StoreOrder["status"]) {
    setBusy(true);setError("");try {await setOrderStatus(order.id,status);setConfirm(null);} catch(e) {setError(e instanceof Error?e.message:"تعذر تحديث الطلب");} finally {setBusy(false);}
  }
  async function save(e:React.FormEvent) {
    e.preventDefault();setBusy(true);setError("");try {await setExpectedDelivery(order.id,eta?new Date(eta).toISOString():null);} catch(e) {setError(e instanceof Error?e.message:"تعذر حفظ الميعاد");} finally {setBusy(false);}
  }
  return <section className="space-y-3 border-t border-brand-50 pt-3">
    {late && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">الطلب عدى ميعاد التوصيل المتوقع بـ {Math.max(1,Math.floor((now-Date.parse(order.expected_at!))/60000))} دقيقة. راجع الموقف وتواصل مع العميل.</p>}
    {order.expected_at && <p className="text-xs text-slate-600">ميعاد التوصيل المتوقع: <time className="font-bold">{new Date(order.expected_at).toLocaleString("ar-EG",{dateStyle:"medium",timeStyle:"short"})}</time></p>}
    {active && <form onSubmit={(e)=>void save(e)} className="flex flex-wrap items-end gap-2"><label className="text-xs font-bold">ميعاد التوصيل المتوقع (توقيت جهازك)<input type="datetime-local" value={eta} onChange={(e)=>setEta(e.target.value)} className="mt-1 block rounded-xl border border-brand-100 px-3 py-2 text-sm" /></label><button disabled={busy} className="rounded-xl border border-brand-200 px-4 py-2 text-xs font-bold disabled:opacity-50">حفظ الميعاد</button><p className="w-full text-[11px] text-slate-500">الميعاد ده بيظهر للعميل كتقدير. لو اتغير، بلغه بالسبب وتأكد من الميعاد الجديد.</p></form>}
    <div className="flex flex-wrap gap-2">{(transitions[order.status]||[]).map((status)=><button key={status} disabled={busy} onClick={()=>status==="delivered"?setConfirm(status):void update(status)} className="rounded-xl bg-brand-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{STATUS_LABEL[status]}</button>)}{active && <button disabled={busy} onClick={()=>setConfirm("cancelled")} className="rounded-xl border border-red-200 px-4 py-2 text-xs font-bold text-red-600">إلغاء الطلب</button>}</div>
    {confirm && <div className="rounded-xl bg-amber-50 p-3 text-sm"><p>{confirm==="delivered"?"تأكد إن العميل استلم الطلب فعلًا. تسجيل التسليم هيفتح له التقييم.":"متأكد من إلغاء الطلب؟ الخطوة دي نهائية."}</p><div className="mt-2 flex gap-2"><button disabled={busy} onClick={()=>void update(confirm)} className="rounded-lg bg-brand-800 px-4 py-2 text-xs font-bold text-white">تأكيد</button><button onClick={()=>setConfirm(null)} className="px-3 text-xs font-bold">تراجع</button></div></div>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {!!order.history?.length && <details className="text-xs text-slate-500"><summary className="cursor-pointer font-bold">سجل حالات الطلب</summary><ol className="mt-2 space-y-2">{order.history.map((h,i)=><li key={i}>{STATUS_LABEL[h.status]} · {new Date(h.at).toLocaleString("ar-EG",{dateStyle:"short",timeStyle:"short"})}</li>)}</ol></details>}
  </section>;
}
