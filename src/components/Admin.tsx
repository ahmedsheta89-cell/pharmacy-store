import { useEffect, useRef, useState } from "react";
import { CATEGORIES, PRODUCTS, formatPrice } from "../lib/catalog";
import {
  isFirebaseConfigured, managerSendPasswordReset, managerSignIn, managerSignOut,
  deleteProductById, seedProducts, upsertProduct, watchAuth, watchOrders, watchProducts,
  watchFeedback, type OrderFeedback, type StoreOrder, type StoreProduct,
} from "../lib/firebase";
import { STORE } from "../lib/site";
import BannersPanel from "./BannersPanel";

import OrderDeliveryPanel, { STATUS_LABEL } from "./OrderDeliveryPanel";

const STATUS_STYLE: Record<StoreOrder["status"], string> = {
  new: "bg-gold-300/50 text-amber-800",
  confirmed: "bg-brand-100 text-brand-800",
  preparing: "bg-blue-50 text-blue-800",
  out_for_delivery: "bg-violet-50 text-violet-800",
  delivered: "bg-brand-700 text-white",
  cancelled: "bg-red-50 text-red-700",
};

const EMPTY_PRODUCT: StoreProduct = {
  id: "", name: "", nameEn: "", category: "medicine", price: 0, unit: "علبة", description: "",
};

function slugifyId(text: string): string {
  const slug = text.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || `product-${Date.now().toString(36)}`;
}

function OrdersPanel({ orders }: { orders: StoreOrder[] | null }) {
  if (orders === null) {
    return <p className="py-16 text-center text-sm text-slate-500">جارٍ تحميل الطلبات...</p>;
  }
  if (orders.length === 0) {
    return (
      <div className="rounded-2xl border border-brand-100 bg-white p-10 text-center">
        <p className="font-black text-brand-950">لا توجد طلبات بعد</p>
        <p className="mt-2 text-sm text-slate-500">طلبات العملاء من المتجر ستظهر هنا فورًا.</p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <p className="text-sm font-bold text-slate-600">إجمالي الطلبات: {orders.length}</p>
      {orders.map((order) => (
        <article key={order.id} className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-50 pb-3">
            <div className="flex items-center gap-3">
              <span dir="ltr" className="font-black text-brand-700">{order.code}</span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLE[order.status]}`}>{STATUS_LABEL[order.status]}</span>
            </div>
            <time className="text-xs text-slate-400" dir="ltr">{new Date(order.created_at).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" })}</time>
          </div>
          <div className="grid gap-4 py-3 sm:grid-cols-2">
            <div>
              <p className="font-black text-brand-950">{order.customer_name}</p>
              <p dir="ltr" className="mt-0.5 text-right text-sm font-bold text-brand-700">{order.customer_phone}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">{order.customer_address}</p>
              {order.notes && <p className="mt-1 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs text-slate-600">ملاحظات: {order.notes}</p>}
            </div>
            <div>
              <ul className="space-y-1 text-sm">
                {order.items.map((item, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span className="text-brand-950">{item.product_name} <span className="text-slate-400">× {item.quantity}</span></span>
                    <span className="font-semibold text-brand-950">{formatPrice(item.unit_price * item.quantity)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 flex justify-between border-t border-brand-50 pt-2 font-black">
                <span>الإجمالي</span><span className="text-brand-700">{formatPrice(order.total)}</span>
              </p>
            </div>
          </div>
          <OrderDeliveryPanel order={order} />
        </article>
      ))}
    </div>
  );
}

function ProductsPanel() {
  const [products, setProducts] = useState<StoreProduct[] | null>(null);
  const [editing, setEditing] = useState<StoreProduct | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsub = watchProducts(setProducts);
    return () => unsub?.();
  }, []);

  const startAdd = () => {
    setIsNew(true);
    setEditing({ ...EMPTY_PRODUCT });
    setError("");
  };

  const startEdit = (product: StoreProduct) => {
    setIsNew(false);
    setEditing({ ...product });
    setError("");
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError("");
    const id = isNew ? `${slugifyId(editing.nameEn || editing.name)}-${crypto.randomUUID().slice(0, 8)}` : editing.id;
    const product: StoreProduct = {
      ...editing,
      id,
      price: Number(editing.price) || 0,
      oldPrice: editing.oldPrice ? Number(editing.oldPrice) : undefined,
      badge: editing.badge?.trim() || undefined,
      imageUrl: editing.imageUrl?.trim() || undefined,
    };
    try {
      await upsertProduct(product);
      setEditing(null);
    } catch {
      setError("تعذّر حفظ المنتج. حاول مرة أخرى.");
    }
    setBusy(false);
  };

  const remove = async (product: StoreProduct) => {
    if (!window.confirm(`حذف "${product.name}" نهائيًا من المتجر؟`)) return;
    setBusy(true);
    try {
      await deleteProductById(product.id);
    } catch {
      setError("تعذّر حذف المنتج. حاول مرة أخرى.");
    }
    setBusy(false);
  };

  const importDefaults = async () => {
    setBusy(true);
    setError("");
    try {
      await seedProducts(PRODUCTS.map((p) => ({ ...p })));
    } catch {
      setError("تعذّر استيراد المنتجات. حاول مرة أخرى.");
    }
    setBusy(false);
  };

  if (products === null) {
    return <p className="py-16 text-center text-sm text-slate-500">جارٍ تحميل المنتجات...</p>;
  }

  if (editing) {
    return (
      <form onSubmit={(e) => void save(e)} className="mx-auto max-w-lg rounded-2xl border border-brand-100 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-black">{isNew ? "إضافة منتج جديد" : `تعديل: ${editing.name}`}</h2>
        <label className="mt-4 block">
          <span className="mb-1.5 block text-sm font-bold">اسم المنتج (عربي)</span>
          <input required value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="w-full rounded-xl border border-brand-100 px-3 py-2.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100" placeholder="بانادول إكسترا 24 قرص" />
        </label>
        <label className="mt-3 block">
          <span className="mb-1.5 block text-sm font-bold">الاسم بالإنجليزي</span>
          <input required={isNew} dir="ltr" value={editing.nameEn} onChange={(e) => setEditing({ ...editing, nameEn: e.target.value })} className="w-full rounded-xl border border-brand-100 px-3 py-2.5 text-left text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100" placeholder="Panadol Extra" />
        </label>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold">القسم</span>
            <select value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} className="w-full rounded-xl border border-brand-100 bg-white px-3 py-2.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100">
              {CATEGORIES.filter((c) => c.id !== "all").map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold">الوحدة</span>
            <input required value={editing.unit} onChange={(e) => setEditing({ ...editing, unit: e.target.value })} className="w-full rounded-xl border border-brand-100 px-3 py-2.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100" placeholder="علبة" />
          </label>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold">السعر (ج.م)</span>
            <input required type="number" min="0" step="0.25" dir="ltr" value={editing.price || ""} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} className="w-full rounded-xl border border-brand-100 px-3 py-2.5 text-left text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100" placeholder="60" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold">السعر قبل الخصم (اختياري)</span>
            <input type="number" min="0" step="0.25" dir="ltr" value={editing.oldPrice ?? ""} onChange={(e) => setEditing({ ...editing, oldPrice: e.target.value ? Number(e.target.value) : undefined })} className="w-full rounded-xl border border-brand-100 px-3 py-2.5 text-left text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100" placeholder="75" />
          </label>
        </div>
        <label className="mt-3 block">
          <span className="mb-1.5 block text-sm font-bold">شارة مميزة (اختياري)</span>
          <input value={editing.badge ?? ""} onChange={(e) => setEditing({ ...editing, badge: e.target.value })} className="w-full rounded-xl border border-brand-100 px-3 py-2.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100" placeholder="الأكثر طلبًا / وفر 20%" />
        </label>
        <label className="mt-3 block">
          <span className="mb-1.5 block text-sm font-bold">الوصف</span>
          <textarea required rows={2} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="w-full rounded-xl border border-brand-100 px-3 py-2.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100" placeholder="وصف مختصر يظهر للعميل" />
        </label>
        <label className="mt-3 block">
          <span className="mb-1.5 block text-sm font-bold">رابط صورة المنتج (اختياري)</span>
          <input dir="ltr" type="url" value={editing.imageUrl ?? ""} onChange={(e) => setEditing({ ...editing, imageUrl: e.target.value })} className="w-full rounded-xl border border-brand-100 px-3 py-2.5 text-left text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100" placeholder="https://…" />
          <span className="mt-1 block text-xs text-slate-400">لو سيبته فاضي هتظهر أيقونة القسم تلقائيًا.</span>
        </label>
        {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
        <div className="mt-5 flex gap-2">
          <button type="submit" disabled={busy} className="flex-1 rounded-xl bg-brand-700 py-3 text-sm font-bold text-white hover:bg-brand-800 disabled:opacity-60">{busy ? "جارٍ الحفظ..." : "حفظ المنتج"}</button>
          <button type="button" onClick={() => setEditing(null)} className="rounded-xl border border-brand-100 px-5 py-3 text-sm font-bold text-slate-600 hover:bg-brand-50">إلغاء</button>
        </div>
      </form>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-slate-600">عدد المنتجات: {products.length}</p>
        <button onClick={startAdd} className="rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-800">+ إضافة منتج</button>
      </div>
      {error && <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
      {products.length === 0 ? (
        <div className="rounded-2xl border border-brand-100 bg-white p-10 text-center">
          <p className="font-black text-brand-950">لا توجد منتجات في قاعدة البيانات بعد</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">المتجر يعرض الآن الكتالوج الأساسي المدمج. استورده هنا مرة واحدة عشان تقدر تضيف وتعدل وتحذف بنفسك — التغييرات تظهر في المتجر فورًا.</p>
          <button onClick={() => void importDefaults()} disabled={busy} className="mt-4 rounded-xl bg-brand-700 px-6 py-3 text-sm font-bold text-white hover:bg-brand-800 disabled:opacity-60">{busy ? "جارٍ الاستيراد..." : `استيراد الكتالوج الحالي (${PRODUCTS.length} منتجًا)`}</button>
        </div>
      ) : (
        <div className="space-y-2">
          {products.map((product) => (
            <article key={product.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-brand-100 bg-white px-4 py-3 shadow-sm">
              <div className="min-w-0">
                <p className="truncate font-bold text-brand-950">{product.name}</p>
                <p className="text-xs text-slate-500">{CATEGORIES.find((c) => c.id === product.category)?.name ?? product.category} · {formatPrice(product.price)} / {product.unit}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => startEdit(product)} className="rounded-xl border border-brand-100 px-3.5 py-2 text-xs font-bold text-brand-700 hover:bg-brand-50">تعديل</button>
                <button onClick={() => void remove(product)} disabled={busy} className="rounded-xl border border-red-200 px-3.5 py-2 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-60">حذف</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Admin() {
  const configured = isFirebaseConfigured();
  const [signedIn, setSignedIn] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const knownOrders = useRef<Set<string> | null>(null);
  const [orders, setOrders] = useState<StoreOrder[] | null>(null);
  const [tab, setTab] = useState<"orders" | "products" | "banners" | "feedback">("orders");

  useEffect(() => {
    const unsub = watchAuth((u) => { setSignedIn(Boolean(u)); setAuthChecked(true); });
    return () => unsub?.();
  }, []);

  useEffect(() => {
    if (!signedIn) { setOrders(null); return; }
    const unsub = watchOrders((next) => {
      const previous = knownOrders.current;
      if (previous && next.some((o) => o.status === "new" && !previous.has(o.id)) && audio.current?.state === "running") {
        const tone = audio.current.createOscillator(); const gain = audio.current.createGain();
        tone.connect(gain); gain.connect(audio.current.destination); tone.frequency.value = 740;
        gain.gain.setValueAtTime(0.08, audio.current.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audio.current.currentTime + 0.5);
        tone.start(); tone.stop(audio.current.currentTime + 0.5);
      }
      knownOrders.current = new Set(next.map((o) => o.id)); setOrders(next);
    });
    return () => unsub?.();
  }, [signedIn]);

  const newCount = orders?.filter((o) => o.status === "new").length || 0;
  useEffect(() => {
    if (signedIn) document.title = `${newCount ? `(${newCount}) طلبات جديدة | ` : ""}إدارة One For All Good`;
    return () => { document.title = "One For All Good"; };
  }, [signedIn, newCount]);
  async function toggleSound() {
    if (soundEnabled) { await audio.current?.suspend(); setSoundEnabled(false); return; }
    if (!audio.current) audio.current = new AudioContext();
    await audio.current.resume(); setSoundEnabled(true);
  }
  const [feedback,setFeedback] = useState<OrderFeedback[]>([]);
  useEffect(()=> { if (!signedIn) return; const unsub=watchFeedback(setFeedback); return ()=>unsub?.(); },[signedIn]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setBusy(true);
    try {
      await managerSignIn(email.trim(), password);
    } catch {
      setAuthError("بيانات الدخول غير صحيحة. تأكد من البريد وكلمة المرور.");
    }
    setBusy(false);
  };

  const resetPassword = async () => {
    const target = email.trim();
    setAuthError("");
    setResetMessage("");
    if (!target) {
      setAuthError("اكتب بريدك الإلكتروني أولًا ثم اضغط نسيت كلمة السر.");
      return;
    }
    setBusy(true);
    try {
      await managerSendPasswordReset(target);
      setResetMessage("أرسلنا لينك إعادة تعيين كلمة السر إلى بريدك. افتح الرابط واختر كلمة جديدة، ثم عد للدخول.");
    } catch {
      setAuthError("تعذّر إرسال لينك إعادة التعيين. تأكد من البريد وحاول مرة أخرى.");
    }
    setBusy(false);
  };

  return (
    <div dir="rtl" className="min-h-screen bg-brand-50/50 font-sans text-brand-950">
      <header className="border-b border-brand-100 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <a href="/" className="rounded-full bg-brand-50 p-2 text-brand-700 hover:bg-brand-100" aria-label="المتجر">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5"><path d="M3 12l9-8 9 8M5 10v10h14V10" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </a>
            <div>
              <h1 className="text-lg font-black">لوحة التحكم</h1>
              <p className="text-xs text-slate-500">{STORE.name}</p>
            </div>
          </div>
          {signedIn ? (
            <button onClick={() => void managerSignOut()} className="rounded-xl border border-brand-100 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-brand-50">تسجيل الخروج</button>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        {!configured ? (
          <div className="rounded-2xl border border-gold-500/40 bg-gold-300/30 p-6 text-center">
            <h2 className="font-black text-brand-950">Firebase غير مهيأ بعد</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">أكمل خطوات إعداد مشروع Firebase (إنشاء المشروع، تفعيل Firestore، وإضافة بيانات الاتصال) ثم أعد نشر الموقع لتظهر الطلبات هنا.</p>
          </div>
        ) : !authChecked ? (
          <p className="py-16 text-center text-sm text-slate-500">جارٍ التحميل...</p>
        ) : !signedIn ? (
          <form onSubmit={signIn} className="mx-auto mt-8 max-w-sm rounded-2xl border border-brand-100 bg-white p-6 shadow-sm">
            <h2 className="text-center text-lg font-black">دخول الإدارة</h2>
            <p className="mt-1 text-center text-xs text-slate-500">خاص بصاحب الصيدلية فقط</p>
            <label className="mt-5 block">
              <span className="mb-1.5 block text-sm font-bold">البريد الإلكتروني</span>
              <input type="email" required dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border border-brand-100 px-3 py-2.5 text-left text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100" placeholder="admin@example.com" />
            </label>
            <label className="mt-3 block">
              <span className="mb-1.5 block text-sm font-bold">كلمة المرور</span>
              <input type="password" required dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-brand-100 px-3 py-2.5 text-left text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100" placeholder="••••••••" />
            </label>
            {authError && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{authError}</p>}
            {resetMessage && <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{resetMessage}</p>}
            <button type="submit" disabled={busy} className="mt-5 w-full rounded-xl bg-brand-700 py-3 text-sm font-bold text-white hover:bg-brand-800 disabled:opacity-60">
              {busy ? "جارٍ الدخول..." : "دخول"}
            </button>
            <button type="button" onClick={() => void resetPassword()} disabled={busy} className="mt-2 w-full rounded-xl border border-brand-100 py-2.5 text-sm font-bold text-brand-700 hover:bg-brand-50 disabled:opacity-60">
              نسيت كلمة السر؟
            </button>
          </form>
        ) : (
          <>
            <section aria-label="متابعة الطلبات المباشرة" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-100 bg-white p-4">
              <div role="status" aria-live="polite"><p className="text-sm font-black"><span className="ml-2 inline-block size-2 rounded-full bg-emerald-500" />متابعة مباشرة أثناء فتح اللوحة</p><p className="mt-1 text-xs text-slate-500">{newCount ? `${newCount} طلب جديد محتاج مراجعتك` : "مفيش طلبات جديدة مستنية المراجعة"}</p></div>
              <button onClick={() => void toggleSound()} className="rounded-xl border border-brand-100 px-4 py-2 text-xs font-bold">{soundEnabled ? "إيقاف صوت الطلبات" : "تفعيل صوت الطلبات الجديدة"}</button>
            </section>
            <div className="mb-5 flex flex-wrap gap-2">
              <button onClick={() => setTab("orders")} className={`rounded-xl px-5 py-2.5 text-sm font-bold transition ${tab === "orders" ? "bg-brand-700 text-white" : "border border-brand-100 bg-white text-slate-600 hover:bg-brand-50"}`}>الطلبات{newCount > 0 && <span className="mr-2 rounded-full bg-gold-300 px-2 py-0.5 text-brand-950">{newCount}</span>}</button>
              <button onClick={() => setTab("products")} className={`rounded-xl px-5 py-2.5 text-sm font-bold transition ${tab === "products" ? "bg-brand-700 text-white" : "border border-brand-100 bg-white text-slate-600 hover:bg-brand-50"}`}>المنتجات</button>
              <button onClick={() => setTab("banners")} className={`rounded-xl px-5 py-2.5 text-sm font-bold transition ${tab === "banners" ? "bg-brand-700 text-white" : "border border-brand-100 bg-white text-slate-600 hover:bg-brand-50"}`}>الإعلانات والعروض</button>
              <button onClick={()=>setTab("feedback")} className={`rounded-xl px-5 py-2.5 text-sm font-bold ${tab==="feedback"?"bg-brand-700 text-white":"border border-brand-100 bg-white text-slate-600"}`}>تقييمات العملاء</button>
            </div>
            {tab === "orders" ? <OrdersPanel orders={orders} /> : tab === "products" ? <ProductsPanel /> : tab==="banners" ? <BannersPanel /> : <section className="space-y-3"><h2 className="font-black">تقييمات العملاء بعد التسليم</h2><p className="text-xs text-slate-500">التقييمات خاصة بالإدارة، مش منشورة في المتجر.</p>{!feedback.length && <p className="rounded-xl bg-white p-8 text-center text-sm text-slate-500">مفيش تقييمات لسه.</p>}{feedback.map((f)=><article key={f.id} className="rounded-xl border border-brand-100 bg-white p-5"><p className="font-bold">{f.rating} / 5</p><p className="mt-2 whitespace-pre-wrap text-sm leading-7">{f.comment || "بدون تعليق"}</p><time className="mt-2 block text-xs text-slate-400">{new Date(f.created_at).toLocaleString("ar-EG")}</time></article>)}</section>}
          </>
        )}
      </main>
    </div>
  );
}
