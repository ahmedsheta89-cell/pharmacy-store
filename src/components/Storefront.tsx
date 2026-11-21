import { useEffect, useMemo, useState } from "react";
import { CATEGORIES, PRODUCTS, formatPrice, type Product } from "../lib/catalog";
import { watchProducts } from "../lib/firebase";
import { STORE } from "../lib/site";
import { useCart } from "../lib/cart";
import ProductImage from "./ProductImage";
import CartDrawer from "./CartDrawer";

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="size-5">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-6">
      <circle cx="9" cy="20" r="1.6" />
      <circle cx="18" cy="20" r="1.6" />
      <path d="M2 3h3l2.6 12.4a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 2-1.6L21 7H6" />
    </svg>
  );
}

function ProductCard({ product, onAdd }: { product: Product; onAdd: () => void }) {
  return (
    <article className="card-hover fade-in overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm">
      <ProductImage category={product.category} name={product.name} imageUrl={product.imageUrl} />
      <div className="p-4">
        {product.badge && (
          <span className="mb-2 inline-block rounded-full bg-gold-400/20 px-2.5 py-0.5 text-[11px] font-bold text-brand-800">
            {product.badge}
          </span>
        )}
        <h3 className="min-h-12 text-sm font-bold leading-6 text-brand-950">{product.name}</h3>
        <p className="mt-1 line-clamp-2 min-h-8 text-xs leading-4 text-slate-500">{product.description}</p>
        <div className="mt-3 flex items-end justify-between">
          <div>
            <span className="text-lg font-black text-brand-700">{formatPrice(product.price)}</span>
            {product.oldPrice && (
              <span className="mr-1.5 text-xs text-slate-400 line-through">{formatPrice(product.oldPrice)}</span>
            )}
            <span className="mr-1 block text-[11px] text-slate-400">/ {product.unit}</span>
          </div>
          <button
            onClick={onAdd}
            className="rounded-xl bg-brand-700 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-brand-600 active:scale-95"
          >
            + أضف
          </button>
        </div>
      </div>
    </article>
  );
}

export default function Storefront() {
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const { add, count, setOpen } = useCart();
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [liveProducts, setLiveProducts] = useState<Product[] | null>(null);

  useEffect(() => {
    const unsub = watchProducts((products) => setLiveProducts(products));
    return () => unsub?.();
  }, []);

  const catalog = liveProducts ?? PRODUCTS;

  const visible = useMemo(() => {
    const q = query.trim();
    return catalog.filter((p) => {
      const inCategory = category === "all" || p.category === category;
      const inQuery = !q || p.name.includes(q) || p.nameEn.toLowerCase().includes(q.toLowerCase()) || p.description.includes(q);
      return inCategory && inQuery;
    });
  }, [category, query, catalog]);

  function handleAdd(product: Product) {
    add(product);
    setJustAdded(product.id);
    setTimeout(() => setJustAdded(null), 1200);
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-brand-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <a href="/" className="flex items-center gap-2.5">
            <span className="grid size-10 place-items-center rounded-xl bg-brand-800 text-gold-300">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="size-5">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
            <span>
              <span className="block text-base font-black leading-4 text-brand-900">{STORE.name}</span>
              <span className="block text-[10px] font-medium tracking-wide text-slate-500">ONE FOR ALL GOOD</span>
            </span>
          </a>
          <div className="relative mx-auto hidden w-full max-w-md sm:block">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث عن دواء أو منتج…"
              className="w-full rounded-xl border border-brand-200 bg-brand-50 py-2.5 pr-10 pl-3 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-400"><SearchIcon /></span>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="relative mr-auto rounded-xl bg-brand-700 p-2.5 text-white transition hover:bg-brand-600 sm:mr-0"
            aria-label="سلة التسوق"
          >
            <CartIcon />
            {count > 0 && (
              <span className="absolute -left-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-gold-400 text-[11px] font-black text-brand-950">
                {count}
              </span>
            )}
          </button>
        </div>
        <div className="border-t border-brand-50 px-4 py-2 sm:hidden">
          <div className="relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث عن دواء أو منتج…"
              className="w-full rounded-xl border border-brand-200 bg-brand-50 py-2 pr-10 pl-3 text-sm outline-none focus:border-brand-400"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-400"><SearchIcon /></span>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-brand-900 text-white">
        <div className="absolute -left-24 -top-24 size-80 rounded-full bg-brand-700/40 blur-3xl" />
        <div className="absolute -bottom-32 -right-16 size-96 rounded-full bg-gold-500/20 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 py-14 sm:py-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-gold-400/40 bg-white/5 px-4 py-1.5 text-xs font-bold text-gold-300">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4"><path d="M20 6 9 17l-5-5" /></svg>
            الدفع عند الاستلام · توصيل سريع
          </span>
          <h1 className="mt-5 max-w-2xl text-3xl font-black leading-tight sm:text-5xl">
            دواؤك ومستلزماتك،
            <br />
            <span className="text-gold-300">لحد باب البيت.</span>
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-brand-100 sm:text-base">
            اطلب من {STORE.name} أونلاين: أدوية، فيتامينات، عناية بالبشرة والشعر، مستلزمات أطفال وأجهزة طبية. اطلب في دقيقة، والدفع كاش عند الاستلام.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#catalog" className="rounded-xl bg-gold-400 px-6 py-3 text-sm font-black text-brand-950 transition hover:bg-gold-300 active:scale-95">
              تسوق الآن
            </a>
            <a href="#trust" className="rounded-xl border border-white/25 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/10">
              ليه تطلب منا؟
            </a>
          </div>
          <div className="mt-10 grid max-w-lg grid-cols-3 gap-4 text-center">
            {[
              { n: "+1000", t: "منتج متوفر" },
              { n: "٣٠ دقيقة", t: "متوسط التوصيل" },
              { n: "كاش", t: "عند الاستلام" },
            ].map((s) => (
              <div key={s.t} className="rounded-2xl border border-white/10 bg-white/5 px-2 py-3">
                <div className="text-lg font-black text-gold-300">{s.n}</div>
                <div className="mt-0.5 text-[11px] text-brand-100">{s.t}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section id="trust" className="border-b border-brand-100 bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-3 px-4 py-6 sm:grid-cols-4">
          {[
            { t: "منتجات أصلية 100%", d: "من موزعين معتمدين" },
            { t: "الدفع عند الاستلام", d: "بدون بطاقات أو محافظ" },
            { t: "صيدلي متاح", d: "للاستشارة قبل الطلب" },
            { t: "استبدال سهل", d: "لو المنتج غير مطابق" },
          ].map((f) => (
            <div key={f.t} className="flex items-start gap-2.5 rounded-2xl bg-brand-50 p-3.5">
              <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-brand-700 text-white">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-4"><path d="M20 6 9 17l-5-5" /></svg>
              </span>
              <span>
                <span className="block text-xs font-bold text-brand-900">{f.t}</span>
                <span className="block text-[11px] text-slate-500">{f.d}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Catalog */}
      <main id="catalog" className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-black text-brand-950">تسوق حسب القسم</h2>
            <p className="mt-1 text-sm text-slate-500">{visible.length} منتج</p>
          </div>
        </div>

        <div className="mb-8 flex gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition ${
                category === c.id
                  ? "bg-brand-800 text-white shadow-md"
                  : "border border-brand-200 bg-white text-brand-800 hover:border-brand-400"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-brand-200 bg-white py-16 text-center">
            <p className="text-lg font-bold text-brand-900">لا توجد نتائج لـ «{query}»</p>
            <p className="mt-2 text-sm text-slate-500">جرب اسمًا آخر، أو اسألنا على واتساب - غالبًا متوفر في الصيدلية.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {visible.map((product) => (
              <div key={product.id} className="relative">
                <ProductCard product={product} onAdd={() => handleAdd(product)} />
                {justAdded === product.id && (
                  <span className="fade-in absolute left-1/2 top-2 -translate-x-1/2 rounded-full bg-brand-800 px-3 py-1 text-[11px] font-bold text-white shadow-lg">
                    ✓ في السلة
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-brand-100 bg-brand-950 py-10 text-brand-100">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:grid-cols-3">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-xl bg-brand-800 text-gold-300">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="size-4"><path d="M12 5v14M5 12h14" /></svg>
              </span>
              <span className="text-base font-black text-white">{STORE.name}</span>
            </div>
            <p className="mt-3 text-xs leading-6 text-brand-200">
              صيدليتك الموثوقة أونلاين. اطلب بسهولة، وادفع عند الاستلام.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">مواعيد العمل</h4>
            <p className="mt-2 text-xs leading-6">يوميًا من ٩ صباحًا حتى ١٢ منتصف الليل</p>
            <h4 className="mt-4 text-sm font-bold text-white">التوصيل</h4>
            <p className="mt-1 text-xs leading-6">داخل المدينة خلال ٣٠-٦٠ دقيقة</p>
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">تحتاج مساعدة؟</h4>
            <p className="mt-2 text-xs leading-6">فريقنا جاهز للرد على استفساراتك وطلباتك الخاصة.</p>
            <a
              href={`https://wa.me/${STORE.whatsappNumber}`}
              target="_blank"
              rel="noreferrer"
              dir="ltr"
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20"
            >
              واتساب: {STORE.whatsappDisplay}
            </a>
            <a href="/admin" className="mt-4 inline-block text-[11px] text-brand-400 underline-offset-4 hover:underline">
              دخول الإدارة
            </a>
          </div>
        </div>
        <p className="mt-8 text-center text-[11px] text-brand-400">© 2026 {STORE.name} - جميع الحقوق محفوظة</p>
      </footer>

      <CartDrawer />
    </div>
  );
}
