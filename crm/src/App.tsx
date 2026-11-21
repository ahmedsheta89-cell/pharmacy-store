import {pinnedOwner,guardedListener} from '../../packages/crm-schema/session.js';
import { useEffect, useState } from "react";
import { Route, Switch, Link, useLocation } from "wouter";
import type { User } from "firebase/auth";
import {
  watchAuth, watchStaffRole, staffSignIn, staffSignOut, watchInbox, watchConversation,
  watchMessages, watchPresence, loadCustomer, recordView, sendReply, addNote, assignConversation,
  setConversationStatus, sendOrderReady, heartbeat, clearPresence, suggestReply, watchStaff,
} from "./lib/crm";
import type { Conversation, ConversationMessage, StaffMember, Customer, Presence } from "../../packages/crm-schema";

const STATUS_LABEL: Record<Conversation["status"], string> = { open: "مفتوحة", pending: "بالانتظار", resolved: "محلولة", snoozed: "مؤجلة" };
const CHANNEL_LABEL: Record<Conversation["channel"], string> = { store: "المتجر", messenger: "ماسنجر", instagram: "إنستجرام", whatsapp: "واتساب" };

function ago(iso: string): string {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (m < 1) return "دلوقتي";
  if (m < 60) return `من ${m} د`;
  const h = Math.round(m / 60);
  if (h < 24) return `من ${h} س`;
  return `من ${Math.round(h / 24)} يوم`;
}

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try { await staffSignIn(email.trim(), password); }
    catch { setError("بيانات الدخول غير صحيحة أو الحساب غير مفعّل."); }
    finally { setBusy(false); }
  }
  return (
    <main dir="rtl" className="grid min-h-dvh place-items-center bg-brand-50 p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-3xl border border-brand-100 bg-white p-8 shadow-xl">
        <h1 className="text-xl font-black text-brand-950">One For All Good , صندوق المحادثات</h1>
        <p className="text-xs text-slate-500">دخول فريق العمل فقط</p>
        <input dir="ltr" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="البريد الإلكتروني" className="w-full rounded-xl border border-brand-100 px-3 py-3 text-sm" />
        <input dir="ltr" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="كلمة السر" className="w-full rounded-xl border border-brand-100 px-3 py-3 text-sm" />
        {error && <p role="alert" className="text-xs font-bold text-red-600">{error}</p>}
        <button disabled={busy} className="w-full rounded-xl bg-brand-700 py-3 text-sm font-bold text-white disabled:opacity-40">{busy ? "..." : "دخول"}</button>
      </form>
    </main>
  );
}

function Inbox({ me }: { me: StaffMember & { id: string } }) {
  const [status, setStatus] = useState<Conversation["status"] | "">("open");
  const [mine, setMine] = useState(false);
  const [rows, setRows] = useState<(Conversation & { id: string })[]>([]);
  const [inboxError,setInboxError]=useState("");
  useEffect(() => {
    setRows([]);setInboxError("");
    let active=true;
    const stop=guardedListener<(Conversation & {id:string})[]>(cb=>watchInbox(
      {status:status||undefined,assignee:mine?me.id:undefined},cb,
      ()=>{if(active){setRows([]);setInboxError("المحادثات غير متاحة. راجع صلاحيات الحساب أو الاتصال.");}}
    ),setRows);
    return ()=>{active=false;stop();};
  },[status,mine,me.id,me.role,me.active]);
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["", "open", "pending", "resolved", "snoozed"] as const).map((s) => (
          <button key={s} onClick={() => setStatus(s)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${status === s ? "bg-brand-700 text-white" : "border border-brand-100"}`}>{s === "" ? "الكل" : STATUS_LABEL[s]}</button>
        ))}
        <label className="mr-auto flex items-center gap-2 text-xs font-bold text-brand-800">
          <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> محادثاتي بس
        </label>
      </div>
      {inboxError && <p role="alert" className="p-4 text-sm text-red-700">{inboxError}</p>}
      {rows.length === 0 && <p className="py-16 text-center text-sm text-slate-500">مفيش محادثات هنا.</p>}
      <ul className="divide-y divide-brand-50 overflow-hidden rounded-2xl border border-brand-100 bg-white">
        {rows.map((c) => (
          <li key={c.id}>
            <Link href={`/c/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-brand-50/60">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-brand-950">{c.customer_name || "عميل"} <span className="font-normal text-slate-400">· {CHANNEL_LABEL[c.channel]}</span></p>
                <p className="truncate text-xs text-slate-500">{c.preview}</p>
              </div>
              {c.awaiting === "staff" && <span className="size-2.5 shrink-0 rounded-full bg-red-500" aria-label="بينتظر رد" />}
              <span className="shrink-0 text-[10px] text-slate-400">{ago(c.last_message_at)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ConversationPage({ id, me, staff }: { id: string; me: StaffMember & { id: string }; staff: (StaffMember & { id: string })[] }) {
  const [conv, setConv] = useState<(Conversation & { id: string }) | null>(null);
  const [convLoaded, setConvLoaded] = useState(false);
  const [messages, setMessages] = useState<(ConversationMessage & { id: string })[]>([]);
  const [others, setOthers] = useState<(Presence & { uid: string })[]>([]);
  const [customer, setCustomer] = useState<(Customer & { id: string }) | null>(null);
  const [draft, setDraft] = useState("");
  const [noteMode, setNoteMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [notice, setNotice] = useState("");

  function clearDeniedConversation(){setConv(null);setConvLoaded(true);setMessages([]);setCustomer(null);setOthers([]);setDraft("");setNotice("الصلاحية اتغيرت أو الاتصال غير متاح. المحادثة اتقفلت للحفاظ على البيانات.");}
  useEffect(() => {setConvLoaded(false);setConv(null);setCustomer(null);setMessages([]);setDraft("");return guardedListener(cb => watchConversation(id,cb,clearDeniedConversation),(c:(Conversation & {id:string})|null)=>{setConv(c);setConvLoaded(true);});}, [id]);
  useEffect(() => {setMessages([]);return guardedListener(cb => watchMessages(id,cb,clearDeniedConversation),setMessages);}, [id]);
  useEffect(() => guardedListener<(Presence & {uid:string})[]>(cb=>watchPresence(id,cb,clearDeniedConversation),p=>setOthers(p.filter(x=>x.uid!==me.id))), [id, me.id]);
  useEffect(() => {let active=true;setCustomer(null);if(conv)void loadCustomer(id).then(c=>{if(active)setCustomer(c);}).catch(()=>{if(active)setCustomer(null);});return ()=>{active=false;};}, [id, conv?.customer_key]);
  useEffect(() => { void recordView(id).catch(() => setNotice("تعذر تسجيل المشاهدة. راجع الاتصال قبل الرد.")); }, [id]);
  useEffect(() => {
    void heartbeat(id, "viewing").catch(() => setNotice("تعذر تحديث حالة التواجد"));
    const t = setInterval(() => void heartbeat(id, "viewing").catch(() => setNotice("تعذر تحديث حالة التواجد")), 20000);
    return () => { clearInterval(t); void clearPresence(id).catch(() => {}); };
  }, [id]);

  const someoneElse = others.some(p => p.state === "typing");
  const otherNames = others.map((o) => staff.find((s) => s.id === o.uid)?.name || "زميل").join("، ");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || busy) return;
    setBusy(true);
    try { noteMode ? await addNote(id, draft) : await sendReply(id, draft); setDraft(""); }
    catch (err) { alert(err instanceof Error ? err.message : "حصل خطأ"); }
    finally { setBusy(false); }
  }
  async function aiDraft() {
    setAiBusy(true);
    try { setDraft(await suggestReply(id)); } catch (err) { alert(err instanceof Error ? err.message : "المساعد مش متاح"); }
    finally { setAiBusy(false); }
  }

  if (!conv) return <p role="status" className="py-16 text-center text-sm text-slate-500">{convLoaded ? "المحادثة غير متاحة أو غير مسندة لحسابك." : "بيتم التحميل..."}</p>;
  return (
    <section className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <div className="overflow-hidden rounded-2xl border border-brand-100 bg-white">
        <header className="flex flex-wrap items-center gap-2 border-b border-brand-50 px-4 py-3">
          <Link href="/" className="text-brand-700">→</Link>
          <h2 className="text-sm font-black text-brand-950">{conv.customer_name || "عميل"} · {CHANNEL_LABEL[conv.channel]}</h2>
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700">{STATUS_LABEL[conv.status]}</span>
          <select
            aria-label="إسناد المحادثة"
            value={conv.assignee_uid || ""}
            onChange={(e) => void assignConversation(id, e.target.value || null).catch(err => setNotice(err.message))}
            className="mr-auto rounded-lg border border-brand-100 px-2 py-1 text-xs"
          >
            <option value="">غير مسندة</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {conv.status !== "resolved"
            ? <button onClick={() => void setConversationStatus(id, "resolved").catch(err => setNotice(err.message))} className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white">حلّها</button>
            : <button onClick={() => void setConversationStatus(id, "open").catch(err => setNotice(err.message))} className="rounded-lg border border-brand-100 px-3 py-1 text-xs font-bold">إعادة فتح</button>}
        </header>
        {notice && <p role="alert" className="bg-red-50 px-4 py-2 text-xs text-red-800">{notice}</p>}
        {someoneElse && <p role="status" className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-800">{otherNames} بيبص على المحادثة دلوقتي , استنى قبل ما ترد عشان الرد ميتكررش.</p>}
        <div className="max-h-[55dvh] space-y-3 overflow-y-auto p-4">
          {messages.map((m) => (
            <div key={m.id} className={
              m.kind === "order_event" ? "mx-auto max-w-[85%] rounded-xl bg-sky-50 px-3 py-2 text-center text-xs text-sky-900"
              : m.kind === "note" ? "ml-auto max-w-[85%] rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 px-4 py-2 text-xs text-amber-900"
              : m.sender === "customer" ? "max-w-[85%] rounded-2xl bg-brand-50 px-4 py-2 text-sm text-brand-950"
              : "mr-auto max-w-[85%] rounded-2xl bg-brand-700 px-4 py-2 text-sm text-white"
            }>
              {m.kind === "note" && <span className="mb-1 block text-[10px] font-black">ملاحظة داخلية</span>}
              {m.body}
            </div>
          ))}
        </div>
        <form onSubmit={send} className="space-y-2 border-t border-brand-100 p-3">
          <div className="flex items-center gap-3 text-[11px] font-bold text-brand-700">
            <label className="flex items-center gap-1"><input type="checkbox" checked={noteMode} onChange={(e) => setNoteMode(e.target.checked)} /> ملاحظة داخلية (العميل مش بيشوفها)</label>
            <button type="button" onClick={aiDraft} disabled={aiBusy} className="mr-auto rounded-full border border-brand-100 px-3 py-1 hover:bg-brand-50 disabled:opacity-40">{aiBusy ? "..." : "اقترح رد بالذكاء الاصطناعي"}</button>
          </div>
          <div className="flex gap-2">
            <textarea value={draft} onChange={(e) => { setDraft(e.target.value); void heartbeat(id, "typing").catch(() => {}); }} rows={2} maxLength={2000} placeholder={noteMode ? "ملاحظة للفريق..." : "ردك للعميل..."} className="min-w-0 flex-1 rounded-xl border border-brand-100 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-200" />
            <button disabled={busy || !draft.trim() || (!noteMode && someoneElse)} className="rounded-xl bg-brand-700 px-5 text-sm font-bold text-white disabled:opacity-40">إرسال</button>
          </div>
        </form>
      </div>
      <aside className="space-y-3 rounded-2xl border border-brand-100 bg-white p-4">
        <h3 className="text-sm font-black text-brand-950">بطاقة العميل</h3>
        <dl className="space-y-1 text-xs text-slate-600">
          <div className="flex justify-between"><dt>الاسم</dt><dd className="font-bold">{customer?.name || conv.customer_name || ","}</dd></div>
          <div className="flex justify-between"><dt>الموبايل</dt><dd dir="ltr" className="font-bold">{customer?.phone || ","}</dd></div>
          <div className="flex justify-between"><dt>عدد الطلبات</dt><dd className="font-bold">{conv.order_ids.length}</dd></div>
        </dl>
        <h4 className="pt-2 text-xs font-black text-brand-950">الطلبات</h4>
        <ul className="space-y-1 text-xs text-slate-600">
          {conv.order_ids.length === 0 && <li>مفيش طلبات مرتبطة.</li>}
          {conv.order_ids.map((o) => <li key={o} className="rounded-lg bg-brand-50 px-2 py-2 text-[11px]"><span dir="ltr" className="block truncate font-mono">{o}</span><button onClick={() => { if (confirm("تأكدت إن الطلب جاهز فعلًا؟ الرسالة هتتبعت للعميل.")) void sendOrderReady(id,o).catch(err => setNotice(err.message)); }} className="mt-2 font-bold text-brand-700">إبلاغ العميل: الطلب جاهز</button></li>)}
        </ul>
      </aside>
    </section>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [me, setMe] = useState<(StaffMember & { id: string }) | null>(null);
  const [staff, setStaff] = useState<(StaffMember & { id: string })[]>([]);
  useEffect(() => watchAuth(next => { setMe(null); setStaff([]); setUser(next); }), []);
  useEffect(() => { setMe(null); return user ? guardedListener(cb => watchStaffRole(user.uid,cb),setMe) : undefined; }, [user?.uid]);
  useEffect(() => { setStaff([]); return user ? guardedListener(watchStaff,setStaff) : undefined; }, [user?.uid]);
  const [, navigate] = useLocation();

  if (user === undefined) return null;
  if (!user) return <Login />;
  // Bootstrap owner passes rules without a staff doc; everyone else needs one.
  const bootstrap = pinnedOwner(user,import.meta.env.VITE_CRM_OWNER_UID);
  if (!me || me.id !== user.uid || !me.active || (me.role === "owner" && !bootstrap)) return <main dir="rtl" className="grid min-h-dvh place-items-center p-4"><p className="text-sm text-slate-600">حسابك لسه مش متفعّل في فريق العمل. كلم مدير النظام.</p></main>;
  const meEffective = me || ({ id: user.uid, name: "أحمد", email: user.email || "", role: "owner", departments: [], active: true, created_at: "" } as StaffMember & { id: string });

  return (
    <div dir="rtl" className="min-h-dvh bg-brand-50/50 text-brand-950">
      <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-brand-100 bg-white px-4 py-3">
        <h1 className="text-sm font-black">One For All Good , المحادثات</h1>
        <nav className="flex gap-3 text-xs font-bold text-brand-700">
          <Link href="/">الصندوق</Link>
        </nav>
        <button onClick={() => void staffSignOut().then(() => navigate("/"))} className="mr-auto text-xs font-bold text-slate-500">خروج ({meEffective.name})</button>
      </header>
      <main className="mx-auto max-w-6xl p-4">
        <Switch>
          <Route path="/" component={() => <Inbox key={user.uid+meEffective.role} me={meEffective} />} />
          <Route path="/c/:id" component={({ params }) => <ConversationPage key={user.uid+params.id} id={params.id} me={meEffective} staff={staff.length ? staff : [meEffective]} />} />
        </Switch>
      </main>
    </div>
  );
}
