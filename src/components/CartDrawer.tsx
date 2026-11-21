import { useState } from "react";
import { useCart } from "../lib/cart";
import { formatPrice } from "../lib/catalog";
import { placeOrder } from "../lib/firebase";
import { STORE } from "../lib/site";
import ProductImage from "./ProductImage";

type Stage = "cart" | "checkout" | "done";

const inputClass =
  "w-full rounded-xl border border-brand-100 bg-white px-3 py-2.5 text-sm text-brand-950 shadow-sm placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100";

export default function CartDrawer() {
  const { lines, total, setQuantity, remove, clear, open, setOpen } = useCart();
  const [stage, setStage] = useState<Stage>("cart");
  const [orderCode, setOrderCode] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", address: "", notes: "" });

  const close = () => {
    setOpen(false);
    setTimeout(() => {
      setStage("cart");
      setError("");
    }, 300);
  };

  const submitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const phone = form.phone.replace(/[\s-]/g, "");
    if (form.name.trim().length < 3) return setError("من فضلك اكتب الاسم بالكامل.");
    if (!/^(\+?20)?0?1[0-9]{9}$/.test(phone)) return setError("رقم الموبايل غير صحيح. اكتب الرقم كاملًا مثل 01012345678.");
    if (form.address.trim().length < 8) return setError("اكتب عنوانًا أوضح للتوصيل (منطقة وشارع ورقم).");
    setSending(true);
    const result = await placeOrder({
      customer_name: form.name.trim(),
      customer_phone: phone,
      customer_address: form.address.trim(),
      notes: form.notes.trim() || null,
      total,
      items: lines.map((line) => ({
        product_id: line.product.id,
        product_name: line.product.name,
        unit_price: line.product.price,
        quantity: line.quantity,
      })),
    });
    setSending(false);
    if (result.ok) {
      setOrderCode(result.orderCode);
      setStage("done");
      clear();
    } else if (result.reason === "not_configured") {
      setError("الطلب المباشر غير مفعّل بعد - اطلب عبر واتساب " + STORE.whatsappDisplay + " وسنؤكد طلبك فورًا.");
    } else {
      setError("تعذّر إرسال الطلب الآن. جرّب مرة أخرى أو اطلب عبر واتساب.");
    }
  };

  return (
    <div className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      <div
        className={`absolute inset-0 bg-black/50 backdrop-blur-[2px] transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}
        onClick={close}
      />
      <aside
        className={`absolute inset-y-0 left-0 flex w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-300 ${open ? "translate-x-0" : "-translate-x-full"}`}
        role="dialog"
        aria-label="سلة المشتريات"
      >
        <header className="flex items-center justify-between border-b border-brand-100 px-5 py-4">
          <h2 className="text-lg font-black text-brand-950">
            {stage === "checkout" ? "إتمام الطلب" : stage === "done" ? "تم استلام طلبك" : "سلة المشتريات"}
          </h2>
          <button onClick={close} className="rounded-full p-2 text-slate-500 hover:bg-brand-50" aria-label="إغلاق">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5"><path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" /></svg>
          </button>
        </header>

        {stage === "cart" && (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {lines.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" className="size-14 text-brand-200"><circle cx="9" cy="20" r="1.4" /><circle cx="17" cy="20" r="1.4" /><path d="M3 3h2l2.6 12.4a1 1 0 0 0 1 .8h8.8a1 1 0 0 0 1-.76L20.5 7H6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  <p className="font-bold text-brand-950">سلتك فارغة</p>
                  <p className="text-sm text-slate-500">أضف منتجات من الكتالوج وستظهر هنا.</p>
                  <p className="rounded-xl bg-gold-300/30 p-3 text-sm font-bold text-brand-950">احتفظ بكود الطلب أو صوّر الشاشة. تحتاج الكود ورقم موبايلك لمتابعة الحالة.</p>
            <a href="/track" className="rounded-xl bg-brand-700 px-6 py-3 text-sm font-bold text-white">تتبع طلبي</a>
            <button onClick={close} className="mt-2 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-800">ابدأ التسوق</button>
                </div>
              ) : (
                <ul className="space-y-3">
                  {lines.map(({ product, quantity }) => (
                    <li key={product.id} className="flex gap-3 rounded-2xl border border-brand-100 p-3">
                      <div className="w-16 shrink-0 overflow-hidden rounded-xl [&>div]:rounded-xl">
                        <ProductImage category={product.category} name={product.name} imageUrl={product.imageUrl} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-sm font-bold text-brand-950">{product.name}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{formatPrice(product.price)} / {product.unit}</p>
                        <div className="mt-2 flex items-center justify-between">
                          <div className="inline-flex items-center rounded-full border border-brand-100">
                            <button onClick={() => setQuantity(product.id, quantity + 1)} className="rounded-r-full px-2.5 py-1 text-brand-700 hover:bg-brand-50" aria-label="زيادة">+</button>
                            <span className="min-w-7 text-center text-sm font-bold">{quantity}</span>
                            <button onClick={() => setQuantity(product.id, quantity - 1)} className="rounded-l-full px-2.5 py-1 text-brand-700 hover:bg-brand-50" aria-label="إنقاص">−</button>
                          </div>
                          <span className="text-sm font-black text-brand-700">{formatPrice(product.price * quantity)}</span>
                        </div>
                      </div>
                      <button onClick={() => remove(product.id)} className="self-start rounded-full p-1.5 text-slate-400 hover:bg-brand-50 hover:text-brand-950" aria-label="حذف المنتج">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {lines.length > 0 && (
              <footer className="border-t border-brand-100 px-5 py-4">
                <div className="mb-1 flex items-center justify-between text-sm text-slate-500">
                  <span>التوصيل</span><span className="font-bold text-brand-700">مجاني</span>
                </div>
                <div className="mb-4 flex items-center justify-between">
                  <span className="font-bold text-brand-950">الإجمالي</span>
                  <span className="text-xl font-black text-brand-950">{formatPrice(total)}</span>
                </div>
                <button onClick={() => setStage("checkout")} className="w-full rounded-xl bg-brand-700 py-3.5 text-sm font-bold text-white shadow-md hover:bg-brand-800">
                  إتمام الطلب - الدفع عند الاستلام
                </button>
              </footer>
            )}
          </>
        )}

        {stage === "checkout" && (
          <form onSubmit={submitOrder} className="flex flex-1 flex-col overflow-y-auto px-5 py-4">
            <div className="space-y-3.5">
              <label className="block">
                <span className="mb-1.5 block text-sm font-bold text-brand-950">الاسم بالكامل</span>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} placeholder="مثال: أحمد محمد علي" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-bold text-brand-950">رقم الموبايل</span>
                <input required dir="ltr" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={`${inputClass} text-right`} placeholder="01xxxxxxxxx" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-bold text-brand-950">عنوان التوصيل</span>
                <textarea required rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={inputClass} placeholder="المنطقة - الشارع - رقم العقار - الدور" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-bold text-brand-950">ملاحظات (اختياري)</span>
                <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputClass} placeholder="أي تفاصيل تساعدنا في التوصيل" />
              </label>
            </div>
            {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700">{error}</p>}
            <div className="mt-auto pt-4">
              <div className="mb-3 flex items-center justify-between rounded-xl bg-brand-50 px-4 py-3">
                <span className="text-sm font-bold text-slate-600">الإجمالي - الدفع عند الاستلام</span>
                <span className="text-lg font-black text-brand-700">{formatPrice(total)}</span>
              </div>
              <button type="submit" disabled={sending} className="w-full rounded-xl bg-brand-700 py-3.5 text-sm font-bold text-white shadow-md hover:bg-brand-800 disabled:opacity-60">
                {sending ? "جارٍ إرسال الطلب..." : "تأكيد الطلب"}
              </button>
              <button type="button" onClick={() => setStage("cart")} className="mt-2 w-full rounded-xl py-2.5 text-sm font-semibold text-slate-500 hover:bg-brand-50">
                الرجوع إلى السلة
              </button>
            </div>
          </form>
        )}

        {stage === "done" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
            <span className="grid size-16 place-items-center rounded-full bg-brand-50 text-brand-700">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-8"><path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
            <h3 className="text-xl font-black text-brand-950">شكرًا لك! استلمنا طلبك</h3>
            <p className="text-sm text-slate-600">رقم الطلب: <span dir="ltr" className="font-black text-brand-700">{orderCode}</span></p>
            <p className="text-sm leading-6 text-slate-600">سنتواصل معك على رقمك لتأكيد الطلب، والتوصيل مجاني. الدفع نقدًا عند الاستلام.</p>
            <p className="rounded-xl bg-gold-300/30 p-3 text-sm font-bold text-brand-950">احتفظ بكود الطلب أو صوّر الشاشة. تحتاج الكود ورقم موبايلك لمتابعة الحالة.</p>
            <a href="/track" className="rounded-xl bg-brand-700 px-6 py-3 text-sm font-bold text-white">تتبع طلبي</a>
            <button onClick={close} className="mt-2 rounded-xl bg-brand-700 px-6 py-3 text-sm font-bold text-white hover:bg-brand-800">متابعة التسوق</button>
          </div>
        )}
      </aside>
    </div>
  );
}
