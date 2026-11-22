import { useEffect, useState } from "react";
import { lookupOrder, type OrderTracking } from "../lib/firebase";
import { formatPrice } from "../lib/catalog";
import { STORE } from "../lib/site";

import OrderReview from "./OrderReview";

const labels = { preparing:"جاري تجهيز طلبك", out_for_delivery:"طلبك خرج للتوصيل", new: "استلمنا طلبك", confirmed: "تم تأكيد الطلب", delivered: "تم التوصيل", cancelled: "الطلب ملغي" };
const notes = { preparing:"الصيدلية بتجهز طلبك للمندوب.", out_for_delivery:"المندوب في الطريق. تابع تليفونك لسهولة التواصل.", new: "الصيدلية هتتواصل معاك لتأكيد التفاصيل.", confirmed: "طلبك اتأكد. للتفاصيل الخاصة بالتوصيل تواصل مع الصيدلية.", delivered: "شكرًا لثقتك فينا. نتمنى لك الصحة والعافية.", cancelled: "لو محتاج مساعدة أو عايز تطلب من جديد تواصل مع الصيدلية." };
const input = "mt-2 w-full rounded-xl border border-brand-100 bg-white px-4 py-3 text-left outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

export default function Tracking() {
  const [now,setNow] = useState(Date.now());
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),60000);return ()=>clearInterval(timer);},[]);
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<OrderTracking | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setMessage(""); setResult(null);
    try {
      const order = await lookupOrder(code, phone);
      if (order) setResult(order);
      else setMessage("مش لاقيين طلب بالبيانات دي. راجع كود الطلب ورقم الموبايل اللي طلبت بيه.");
    } catch {
      setMessage("تعذر التحقق دلوقتي. جرّب تاني بعد شوية أو كلم الصيدلية.");
    } finally { setBusy(false); }
  }

  return <main dir="rtl" className="min-h-screen bg-brand-50/60 px-4 py-10 text-brand-950">
    <div className="mx-auto max-w-lg">
      <a href="/" className="text-sm font-bold text-brand-700">← العودة للمتجر</a>
      <section className="mt-6 rounded-3xl border border-brand-100 bg-white p-6 shadow-sm sm:p-9">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-600">{STORE.name}</p>
        <h1 className="mt-2 text-3xl font-black">طلبك وصل لفين؟</h1>
        <p className="mt-3 text-sm leading-7 text-slate-500">اكتب كود الطلب ورقم الموبايل اللي سجلته وقت الطلب. بنعرض الحالة بس، من غير أي بيانات شخصية.</p>
        <form onSubmit={(e) => void submit(e)} className="mt-6 space-y-4">
          <label className="block text-sm font-bold">كود الطلب<input required dir="ltr" autoComplete="off" maxLength={20} value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setResult(null); }} className={`${input} uppercase tracking-widest`} placeholder="الكود من شاشة تأكيد الطلب" /></label>
          <label className="block text-sm font-bold">رقم الموبايل<input required dir="ltr" type="tel" autoComplete="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setResult(null); }} className={input} placeholder="01012345678" /></label>
          <button disabled={busy} className="w-full rounded-xl bg-brand-700 py-3.5 font-bold text-white hover:bg-brand-800 disabled:opacity-60">{busy ? "جارٍ البحث..." : "اعرض حالة الطلب"}</button>
        </form>
        {message && <p role="status" className="mt-5 rounded-xl bg-amber-50 p-4 text-sm leading-7 text-amber-900">{message}</p>}
        {result && <section role="status" className="mt-6 rounded-2xl border border-brand-100 bg-brand-50 p-5">
          <span className="text-xs font-bold text-brand-600">الحالة الحالية</span>
          <h2 className="mt-2 text-2xl font-black">{labels[result.status]}</h2>
          <p className="mt-2 text-sm leading-7">{notes[result.status]}</p>
          {result.expected_at && <p className="mt-4 rounded-xl bg-white p-3 text-sm leading-7"><span className="block text-xs text-slate-500">ميعاد التوصيل المتوقع (توقيت القاهرة)</span><time className="font-bold">{new Date(result.expected_at).toLocaleString("ar-EG",{dateStyle:"medium",timeStyle:"short",timeZone:"Africa/Cairo"})}</time></p>}
          {result.expected_at && Date.parse(result.expected_at)<now && !["delivered","cancelled"].includes(result.status) && <p role="alert" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm leading-7 text-amber-900">الميعاد المتوقع عدى ولسه الطلب مش متسجل تم تسليمه. كلم الصيدلية لمعرفة آخر تحديث. الميعاد تقديري مش ضمان.</p>}
          {!!result.history?.length && <ol aria-label="مراحل الطلب" className="mt-4 space-y-3 border-r-2 border-brand-200 pr-4">{result.history.map((h,i)=><li key={i} className="text-sm"><p className="font-bold">{labels[h.status]}</p><time className="text-xs text-slate-500">{new Date(h.at).toLocaleString("ar-EG",{dateStyle:"short",timeStyle:"short",timeZone:"Africa/Cairo"})}</time></li>)}</ol>}
          <dl className="mt-4 space-y-2 border-t border-brand-100 pt-4 text-sm">
            {result.pricing_version===2&&<><div className="flex justify-between"><dt>قيمة المنتجات</dt><dd>{formatPrice(result.subtotal!)}</dd></div><div className="flex justify-between"><dt>التوصيل</dt><dd>{formatPrice(result.delivery_fee!)}</dd></div></>}
            <div className="flex justify-between"><dt>الإجمالي</dt><dd className="font-bold">{formatPrice(result.total)}</dd></div>
            <div className="flex justify-between"><dt>تاريخ الطلب</dt><dd>{new Date(result.created_at).toLocaleDateString("ar-EG")}</dd></div>
          </dl>
          <button onClick={() => void submit({ preventDefault() {} } as React.FormEvent)} disabled={busy} className="mt-4 text-sm font-bold text-brand-700 underline">تحديث الحالة</button>
        </section>}
        {result?.status === "delivered" && <OrderReview key={code+phone} code={code} phone={phone} />}
        <p className="mt-6 text-center text-sm text-slate-500">محتاج مساعدة؟ كلمنا: <a dir="ltr" className="font-bold text-brand-700" href={`tel:${STORE.whatsappNumber}`}>{STORE.whatsappDisplay}</a></p>
      </section>
    </div>
  </main>;
}
