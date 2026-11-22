import { useEffect, useState } from "react";
import { deleteBanner, saveBanner, watchBanners, type PromoBanner } from "../lib/firebase";

const field = "mt-2 w-full rounded-xl border border-brand-100 bg-white px-3 py-2.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100";
const blank: PromoBanner = { id: "", title: "", text: "", enabled: true, linkUrl: "", linkLabel: "", imageUrl: "" };
export function safePromoLink(value?: string) {
  if (!value) return "";
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try { const u = new URL(value); return u.protocol === "https:" ? u.href : ""; } catch { return ""; }
}

export default function BannersPanel() {
  const [banners, setBanners] = useState<PromoBanner[] | null>(null);
  const [editing, setEditing] = useState<PromoBanner | null>(null);
  const [confirmDelete, setConfirmDelete] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { const unsub = watchBanners(setBanners); return () => unsub?.(); }, []);
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!editing) return;
    if (editing.linkUrl && !safePromoLink(editing.linkUrl)) { setError("استخدم رابط HTTPS أو مسار داخل المتجر يبدأ بشرطة مائلة."); return; }
    setBusy(true); setError("");
    try { await saveBanner({ ...editing, id: editing.id || crypto.randomUUID() }); setEditing(null); }
    catch { setError("تعذر حفظ الإعلان. حاول مرة أخرى."); }
    finally { setBusy(false); }
  }
  async function remove(id: string) {
    setBusy(true); setError("");
    try { await deleteBanner(id); setConfirmDelete(""); }
    catch { setError("تعذر حذف الإعلان."); }
    finally { setBusy(false); }
  }
  if (!banners) return <p className="py-12 text-center text-sm text-slate-500">جارٍ تحميل الإعلانات...</p>;
  return <section>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-black">إعلانات وعروض داخل المتجر</h2><p className="mt-1 text-xs text-slate-500">تظهر الإعلانات المفعلة فوق المنتجات فورًا، بدون إعلانات ممولة أو رسوم.</p></div><button onClick={() => { setEditing({ ...blank }); setError(""); }} className="rounded-xl bg-brand-700 px-4 py-3 text-sm font-bold text-white">+ إعلان جديد</button></div>
    {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {editing ? <form onSubmit={(e) => void save(e)} className="mx-auto max-w-lg rounded-2xl border border-brand-100 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-black">{editing.id ? "تعديل الإعلان" : "إعلان جديد"}</h3>
      <label className="mt-4 block text-sm font-bold">عنوان الإعلان<input required maxLength={100} value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className={field} /></label>
      <label className="mt-4 block text-sm font-bold">نص الإعلان<textarea required maxLength={400} rows={3} value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} className={field} /></label>
      <label className="mt-4 block text-sm font-bold">رابط الصورة (اختياري)<input type="url" dir="ltr" value={editing.imageUrl} onChange={(e) => setEditing({ ...editing, imageUrl: e.target.value })} className={field} placeholder="https://…" /></label>
      <label className="mt-4 block text-sm font-bold">رابط الزر (اختياري)<input dir="ltr" value={editing.linkUrl} onChange={(e) => setEditing({ ...editing, linkUrl: e.target.value })} className={field} placeholder="/#catalog" /></label>
      <label className="mt-4 block text-sm font-bold">اسم الزر<input maxLength={40} value={editing.linkLabel} onChange={(e) => setEditing({ ...editing, linkLabel: e.target.value })} className={field} placeholder="شوف العرض" /></label>
      <label className="mt-4 flex items-center gap-3 text-sm font-bold"><input type="checkbox" checked={editing.enabled} onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })} />الإعلان مفعل وظاهر للعملاء</label>
      <div className="mt-6 flex gap-2"><button disabled={busy} className="flex-1 rounded-xl bg-brand-700 py-3 font-bold text-white disabled:opacity-50">{busy ? "جارٍ الحفظ..." : "حفظ الإعلان"}</button><button type="button" onClick={() => setEditing(null)} className="rounded-xl border border-brand-100 px-5 text-sm font-bold">إلغاء</button></div>
    </form> : banners.length === 0 ? <p className="rounded-2xl border border-dashed border-brand-200 bg-white p-10 text-center text-sm text-slate-500">مفيش إعلانات لسه. أضف أول إعلان لمنتج أو عرض عندك.</p> : <div className="space-y-3">{banners.map((b) => <article key={b.id} className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm"><div className="flex justify-between gap-4"><h3 className="font-black">{b.title}</h3><span className={`rounded-full px-3 py-1 text-xs font-bold ${b.enabled ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-500"}`}>{b.enabled ? "ظاهر للعملاء" : "مخفي"}</span></div><p className="mt-2 text-sm leading-7 text-slate-500">{b.text}</p><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => { setEditing({ ...b }); setError(""); }} className="rounded-lg border border-brand-100 px-4 py-2 text-sm font-bold text-brand-700">تعديل</button>{confirmDelete === b.id ? <><span className="self-center text-sm text-red-700">حذف الإعلان نهائيًا؟</span><button disabled={busy} onClick={() => void remove(b.id)} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white">تأكيد الحذف</button><button onClick={() => setConfirmDelete("")} className="px-3 text-sm">تراجع</button></> : <button onClick={() => setConfirmDelete(b.id)} className="rounded-lg border border-red-100 px-4 py-2 text-sm font-bold text-red-600">حذف</button>}</div></article>)}</div>}
  </section>;
}

export function StorePromos() {
  const [banners, setBanners] = useState<PromoBanner[]>([]);
  useEffect(() => { const unsub = watchBanners(setBanners); return () => unsub?.(); }, []);
  const active = banners.filter((b) => b.enabled);
  if (!active.length) return null;
  return <section dir="rtl" aria-label="عروض وإعلانات المتجر" className="mx-auto grid max-w-6xl gap-4 px-4 pt-8 sm:grid-cols-2">{active.map((b) => <article key={b.id} className="store-promo overflow-hidden rounded-2xl border border-gold-500/20 bg-gradient-to-br from-brand-900 to-brand-700 text-white shadow-sm">{b.imageUrl && <img src={b.imageUrl} alt="" className="h-40 w-full object-cover" loading="lazy" />}<div className="p-6"><span className="text-xs font-bold text-gold-300">من المتجر</span><h2 className="mt-2 text-2xl font-black">{b.title}</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-white/85">{b.text}</p>{safePromoLink(b.linkUrl) && <a href={safePromoLink(b.linkUrl)} className="mt-5 inline-block rounded-xl bg-gold-300 px-5 py-2.5 text-sm font-black text-brand-950">{b.linkLabel || "اعرف أكتر"} ←</a>}</div></article>)}</section>;
}
