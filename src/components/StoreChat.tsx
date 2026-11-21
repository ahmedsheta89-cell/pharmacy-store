import { useEffect, useRef, useState } from "react";
import { STORE } from "../lib/site";

const ENDPOINT = "https://oneforallgood-assistant.oneforallgood-store.workers.dev/chat";
type Message = { role: "user" | "assistant"; text: string };
const start: Message = { role: "assistant", text: "أهلاً بيك في One For All Good. أقدر أساعدك في طريقة الطلب والدفع والتتبع. إيه سؤالك؟" };
const suggestions = ["أطلب إزاي؟", "الدفع إزاي؟", "أتابع طلبي إزاي؟", "التوصيل فين وإمتى؟"];

export default function StoreChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([start]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (open) field.current?.focus(); }, [open]);
  useEffect(() => { if (open) end.current?.scrollIntoView({ block: "nearest" }); }, [messages, busy, open]);
  function close() { setOpen(false); launcher.current?.focus(); }
  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setMessages((old) => [...old.slice(-19), { role: "user", text: message }]);
    setInput(""); setBusy(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }), signal: controller.signal });
      const result = await response.json();
      if (typeof result.reply !== "string") throw new Error("No reply");
      setMessages((old) => [...old, { role: "assistant", text: result.reply }]);
    } catch {
      setMessages((old) => [...old, { role: "assistant", text: "الاتصال بمساعد المتجر مش متاح دلوقتي. جرّب تاني أو كلم الصيدلية على " + STORE.phoneDisplay + ". طلباتك والتتبع شغالين بشكل مستقل." }]);
    } finally { clearTimeout(timeout); setBusy(false); }
  }
  return <div dir="rtl" className="fixed bottom-4 left-4 z-40 sm:bottom-6 sm:left-6">
    {open && <section aria-label="مساعد المتجر" onKeyDown={(e) => { if (e.key === "Escape") close(); }} className="store-chat mb-3 flex h-[min(580px,80dvh)] w-[min(380px,calc(100vw-32px))] flex-col overflow-hidden rounded-3xl border border-brand-100 bg-white text-brand-950 shadow-2xl">
      <header className="flex items-center justify-between bg-brand-900 px-5 py-4 text-white"><div><h2 className="font-black">مساعد المتجر</h2><p className="mt-1 text-[11px] text-white/70">رد آلي للتسوق، مش استشارة طبية</p></div><button onClick={close} aria-label="إغلاق الدردشة" className="grid size-9 place-items-center rounded-full bg-white/10 text-xl hover:bg-white/20">×</button></header>
      <p className="store-chat-notice border-b border-brand-50 bg-brand-50/70 px-4 py-2 text-[10px] leading-5 text-slate-600">متبعتش بيانات صحية أو شخصية. سؤالك ممكن يتعالج بخدمة ذكاء اصطناعي خارجية. الردود ممكن تغلط، والتفاصيل النهائية مع الصيدلي.</p>
      <div role="log" aria-live="polite" aria-relevant="additions" className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m, i) => <p key={i} className={`max-w-[92%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-7 ${m.role === "user" ? "mr-auto bg-brand-700 text-white" : "ml-auto bg-brand-50 text-brand-950"}`}><span className="sr-only">{m.role === "user" ? "أنت: " : "مساعد المتجر: "}</span>{m.text}</p>)}
        {busy && <p role="status" className="text-xs text-slate-500">المساعد بيكتب...</p>}<div ref={end} />
      </div>
      {messages.length === 1 && <div className="flex flex-wrap gap-2 px-4 pb-3">{suggestions.map((q) => <button key={q} onClick={() => void send(q)} className="rounded-full border border-brand-100 px-3 py-2 text-[11px] font-bold hover:bg-brand-50">{q}</button>)}</div>}
      <div className="flex justify-center gap-5 border-t border-brand-50 px-3 py-2 text-[11px] font-bold text-brand-700"><a href="/track" className="underline">تتبع الطلب</a><a href={`tel:${STORE.whatsappNumber}`} className="underline">كلم الصيدلية</a></div>
      <form onSubmit={(e) => { e.preventDefault(); void send(input); }} className="flex gap-2 border-t border-brand-100 p-3"><input ref={field} value={input} onChange={(e) => setInput(e.target.value)} aria-label="رسالتك لمساعد المتجر" placeholder="اكتب سؤالك عن المتجر..." maxLength={1000} autoComplete="off" className="min-w-0 flex-1 rounded-xl border border-brand-100 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-200" /><button disabled={busy || !input.trim()} className="rounded-xl bg-brand-700 px-4 text-sm font-bold text-white disabled:opacity-40">إرسال</button></form>
    </section>}
    <button ref={launcher} onClick={() => open ? close() : setOpen(true)} aria-expanded={open} aria-label={open ? "إغلاق مساعد المتجر" : "افتح مساعد المتجر"} className="flex items-center gap-2 rounded-full bg-brand-800 px-5 py-3.5 text-sm font-black text-white shadow-xl ring-4 ring-white/80 hover:bg-brand-700"><svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 4h16v12H9l-5 4V4Z" /><path d="M8 8h8M8 12h5" /></svg>{open ? "إغلاق" : "اسأل مساعد المتجر"}</button>
  </div>;
}
