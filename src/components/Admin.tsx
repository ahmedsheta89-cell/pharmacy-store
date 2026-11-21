import { useEffect, useState } from "react";
import { formatPrice } from "../lib/catalog";
import {
  isFirebaseConfigured, managerSignIn, managerSignOut, setOrderStatus,
  watchAuth, watchOrders, type StoreOrder,
} from "../lib/firebase";
import { STORE } from "../lib/site";

const STATUS_LABEL: Record<StoreOrder["status"], string> = {
  new: "جديد",
  confirmed: "تم التأكيد",
  delivered: "تم التوصيل",
  cancelled: "ملغي",
};

const STATUS_STYLE: Record<StoreOrder["status"], string> = {
  new: "bg-gold-300/50 text-amber-800",
  confirmed: "bg-brand-100 text-brand-800",
  delivered: "bg-brand-700 text-white",
  cancelled: "bg-red-50 text-red-700",
};

export default function Admin() {
  const configured = isFirebaseConfigured();
  const [signedIn, setSignedIn] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [busy, setBusy] = useState(false);
  const [orders, setOrders] = useState<StoreOrder[] | null>(null);

  useEffect(() => {
    const unsub = watchAuth((u) => { setSignedIn(Boolean(u)); setAuthChecked(true); });
    return () => unsub?.();
  }, []);

  useEffect(() => {
    if (!signedIn) { setOrders(null); return; }
    const unsub = watchOrders(setOrders);
    return () => unsub?.();
  }, [signedIn]);

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

  return (
    <div dir="rtl" className="min-h-screen bg-brand-50/50 font-sans text-brand-950">
      <header className="border-b border-brand-100 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <a href="/" className="rounded-full bg-brand-50 p-2 text-brand-700 hover:bg-brand-100" aria-label="المتجر">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5"><path d="M3 12l9-8 9 8M5 10v10h14V10" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </a>
            <div>
              <h1 className="text-lg font-black">لوحة الطلبات</h1>
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
            <button type="submit" disabled={busy} className="mt-5 w-full rounded-xl bg-brand-700 py-3 text-sm font-bold text-white hover:bg-brand-800 disabled:opacity-60">
              {busy ? "جارٍ الدخول..." : "دخول"}
            </button>
          </form>
        ) : orders === null ? (
          <p className="py-16 text-center text-sm text-slate-500">جارٍ تحميل الطلبات...</p>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl border border-brand-100 bg-white p-10 text-center">
            <p className="font-black text-brand-950">لا توجد طلبات بعد</p>
            <p className="mt-2 text-sm text-slate-500">طلبات العملاء من المتجر ستظهر هنا فورًا.</p>
          </div>
        ) : (
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
                <div className="flex flex-wrap gap-2 border-t border-brand-50 pt-3">
                  {order.status === "new" && (
                    <button onClick={() => void setOrderStatus(order.id, "confirmed")} className="rounded-xl bg-brand-700 px-4 py-2 text-xs font-bold text-white hover:bg-brand-800">تأكيد الطلب</button>
                  )}
                  {order.status === "confirmed" && (
                    <button onClick={() => void setOrderStatus(order.id, "delivered")} className="rounded-xl bg-brand-700 px-4 py-2 text-xs font-bold text-white hover:bg-brand-800">تم التوصيل</button>
                  )}
                  {(order.status === "new" || order.status === "confirmed") && (
                    <button onClick={() => void setOrderStatus(order.id, "cancelled")} className="rounded-xl border border-red-200 px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50">إلغاء</button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
