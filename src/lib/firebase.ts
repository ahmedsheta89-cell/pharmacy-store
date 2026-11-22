import {reviewIssues} from "./productReview";
import {derivedVisibility, eligibleForDisplay, importVisibility} from "./productVisibility";
import {parseAppearance, isTheme,validSeasons, type StoreAppearance} from "./themes";
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getFirestore, arrayUnion, runTransaction, collection, getDoc, getDocFromServer, setDoc, deleteDoc, serverTimestamp, query, where, orderBy,
  onSnapshot, doc, type Firestore, type Unsubscribe,
} from "firebase/firestore";
import {
  getAuth, signInWithEmailAndPassword, sendPasswordResetEmail, signOut, onAuthStateChanged,
  type Auth, type User,
} from "firebase/auth";

// Firebase web config is public by design - security is enforced by Firestore rules.
const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "AIzaSyCsRvLEcaGr1DV6a6HFHmR4Xe9mzqgpApQ",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "one-for-all-good.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "one-for-all-good",
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "1:286528426482:web:d3fe576f3043fe2c0a5b6b",
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

export function isFirebaseConfigured(): boolean {
  return Boolean(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId && FIREBASE_CONFIG.appId);
}

function ensure(): { db: Firestore; auth: Auth } | null {
  if (!isFirebaseConfigured()) return null;
  if (!app) {
    app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
    db = getFirestore(app);
    auth = getAuth(app);
  }
  return { db: db!, auth: auth! };
}

export type OrderItem = {
  product_id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
};

export type OrderPayload = {
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  notes: string | null;
  total: number;
  items: OrderItem[];
};

export type StoreOrder = OrderPayload & {
  id: string;
  code: string;
  status: "new" | "confirmed" | "preparing" | "out_for_delivery" | "delivered" | "cancelled";
  expected_at?: string | null;
  history?: StatusEvent[];
  created_at: string;
};

export type PlaceOrderResult =
  | { ok: true; orderCode: string }
  | { ok: false; reason: "not_configured" | "error"; message?: string };

export function normalizePhone(value: string): string {
  return value.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[^0-9]/g, "").replace(/^(0020|20)/, "").replace(/^0/, "");
}

export async function trackingKey(code: string, phone: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${code.trim().toUpperCase()}|${normalizePhone(phone)}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, "0")).join("");
}

export type StatusEvent = { status: StoreOrder["status"]; at: string };
export type OrderTracking = { status: StoreOrder["status"]; total: number; created_at: string; expected_at?: string | null; history?: StatusEvent[] };

export async function lookupOrder(code: string, phone: string): Promise<OrderTracking | null> {
  const ctx = ensure();
  if (!ctx) throw new Error("Firebase غير مهيأ");
  const snap = await getDocFromServer(doc(ctx.db, "tracking", await trackingKey(code, phone)));
  if (!snap.exists()) return null;
  const data = snap.data();
  return { status: data.status, total: data.total, created_at: data.created_at, expected_at: data.expected_at, history: data.history };
}

export async function placeOrder(payload: OrderPayload): Promise<PlaceOrderResult> {
  const ctx = ensure();
  if (!ctx) return { ok: false, reason: "not_configured" };
  try {
    const fingerprint = JSON.stringify(payload);
    let pending: {fingerprint:string;request_id:string} | null = null;
    try { pending=JSON.parse(sessionStorage.getItem("pending-order")||"null"); } catch {}
    if (!pending || pending.fingerprint!==fingerprint) pending={fingerprint,request_id:crypto.randomUUID()};
    sessionStorage.setItem("pending-order",JSON.stringify(pending));
    const response=await fetch("https://oneforallgood-assistant.oneforallgood-store.workers.dev/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...payload,request_id:pending.request_id})});
    const result=await response.json();
    if (!response.ok) throw new Error(result.error==="store_closed"?"استقبال الطلبات متوقف مؤقتًا. حاول لاحقًا.":result.error==="settings_unavailable"?"تعذر التحقق من حالة المتجر. حاول لاحقًا.":result.error==="product_unavailable"||result.error==="catalog_changed"?"منتج في السلة لم يعد متاحًا أو اتغير. حدث المتجر وراجع السلة قبل التأكيد.":result.error==="price_changed"?"سعر منتج اتغير. حدث المتجر وراجع إجمالي السلة قبل التأكيد.":response.status===429?"استنى دقيقة قبل إرسال طلب جديد.":"تعذر إرسال الطلب. راجع البيانات وجرب تاني، أو كلم الصيدلية.");
    sessionStorage.removeItem("pending-order");
    return {ok:true,orderCode:result.orderCode};
  } catch(error) {return {ok:false,reason:"error",message:error instanceof Error?error.message:"تعذر إرسال الطلب"};}
}
async function requestOrderNotification(orderId:string) {
  const ctx=ensure();const user=ctx?.auth.currentUser;if(!user)return;
  try {await fetch("https://oneforallgood-assistant.oneforallgood-store.workers.dev/notify",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+await user.getIdToken()},body:JSON.stringify({order_id:orderId})});}catch{}
}

export async function uploadProductPhoto(blob:Blob, signal?:AbortSignal):Promise<string> {
  const user=ensure()?.auth.currentUser;
  if(!user)throw new Error("سجل الدخول بحساب إدارة المتجر أولًا.");
  if(blob.type!=="image/jpeg"||blob.size>200*1024)throw new Error("الصورة لم تُجهّز بالحجم الصحيح.");
  const token=await user.getIdToken();
  if(signal?.aborted)throw new Error("تم إلغاء الرفع.");
  const controller=new AbortController();const abort=()=>controller.abort();
  signal?.addEventListener("abort",abort,{once:true});
  const timer=setTimeout(abort,45000);
  try{
    const response=await fetch("https://oneforallgood-assistant.oneforallgood-store.workers.dev/photos",{method:"POST",headers:{"Content-Type":"image/jpeg",Authorization:"Bearer "+token},body:blob,signal:controller.signal});
    let data:{url?:string;error?:string};
    try{data=await response.json();}catch{throw new Error("تعذر قراءة نتيجة الرفع. جرّب لاحقًا.");}
    if(!response.ok)throw new Error(response.status===401||response.status===403?"انتهت جلسة الدخول أو الحساب غير مخوّل. سجل الدخول بحساب المالك.":response.status===429?"تم الوصول لحد الرفع المؤقت. انتظر دقيقة وجرب تاني.":response.status===413?"حجم الصورة أكبر من المسموح.":response.status===400||response.status===415?"الصورة غير صالحة للرفع. اختر نسخة JPG أخرى.":"رفع الصور غير متاح مؤقتًا، وقد يكون حد الخدمة المجانية استُنفد. لم تتغير الصورة السابقة.");
    if(!data.url||!/^https:\/\/oneforallgood-assistant\.oneforallgood-store\.workers\.dev\/media\/[a-f0-9]{64}$/.test(data.url))throw new Error("نتيجة رفع غير متوقعة. لم تُربط الصورة بالمنتج.");
    return data.url;
  }catch(e){if(controller.signal.aborted)throw new Error("توقف الرفع أو انتهت مهلة الاتصال. يمكنك المحاولة مجددًا.");throw e;}
  finally{clearTimeout(timer);signal?.removeEventListener("abort",abort);}
}

export function watchOrders(callback: (orders: StoreOrder[]) => void): Unsubscribe | null {
  const ctx = ensure();
  if (!ctx) return null;
  const q = query(collection(ctx.db, "orders"), orderBy("created_at", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StoreOrder, "id">) })));
  });
}

export async function setOrderStatus(orderId: string, status: StoreOrder["status"]): Promise<void> {
  const ctx = ensure();
  if (!ctx) throw new Error("Firebase غير مهيأ");
  const orderRef = doc(ctx.db, "orders", orderId);
  await runTransaction(ctx.db, async (transaction) => {
    const order = await transaction.get(orderRef);
    if (!order.exists()) throw new Error("الطلب مش موجود");
    const current = order.data().status as StoreOrder["status"];
    const allowed: Record<StoreOrder["status"], StoreOrder["status"][]> = {
      new:["confirmed","cancelled"],confirmed:["preparing","out_for_delivery","delivered","cancelled"],
      preparing:["out_for_delivery","cancelled"],out_for_delivery:["delivered","cancelled"],delivered:[],cancelled:[]
    };
    if (!allowed[current]?.includes(status)) throw new Error("حالة الطلب اتغيرت. حدث الصفحة وجرب تاني");
    const at = new Date().toISOString();
    const update = { status, history: arrayUnion({status,at}), updated_at: at };
    transaction.update(orderRef, {...update,notification_pending:true});
    const trackingId = order.data().tracking_id;
    if (trackingId) transaction.update(doc(ctx.db,"tracking",trackingId), update);
  });
  void requestOrderNotification(orderId);
}

export function watchAuth(callback: (user: User | null) => void): Unsubscribe | null {
  const ctx = ensure();
  if (!ctx) return null;
  return onAuthStateChanged(ctx.auth, callback);
}

export async function managerSignIn(email: string, password: string): Promise<void> {
  const ctx = ensure();
  if (!ctx) throw new Error("Firebase غير مهيأ بعد - أكمل إعداد المشروع أولًا.");
  await signInWithEmailAndPassword(ctx.auth, email, password);
}

export async function managerSignOut(): Promise<void> {
  const ctx = ensure();
  if (ctx) await signOut(ctx.auth);
}

export async function managerSendPasswordReset(email: string): Promise<void> {
  const ctx = ensure();
  if (!ctx) throw new Error("Firebase غير مهيأ بعد - أكمل إعداد المشروع أولًا.");
  await sendPasswordResetEmail(ctx.auth, email);
}

// ---- Product catalog (Firestore-backed, manager-managed) ----

export type StoreProduct = {
  id: string;
  name: string;
  nameEn: string;
  category: string;
  price: number;
  oldPrice?: number;
  unit: string;
  badge?: string;
  description: string;
  imageUrl?: string;
  dosage_information?: string;
  usage_instructions?: string;
  warnings?: string;
  content_source?: string;
  content_reviewer?: string;
  content_reviewed_at?: string;
  content_version?: string;
  content_review_status?: "unreviewed" | "reviewed";
  prescription_status?: "unknown" | "non_prescription" | "prescription" | "not_medicine";
  advertising_status?: "unreviewed" | "approved" | "blocked";
  owner_hidden?: boolean;
  public_visible?: boolean;
  stock_quantity?: number;
  import_source?: string;
};

export function watchProducts(callback: (products: StoreProduct[]) => void, manager = false): Unsubscribe | null {
  const ctx = ensure();
  if (!ctx) return null;
  const q = manager ? query(collection(ctx.db, "products"), orderBy("name")) : query(collection(ctx.db,"products"),where("public_visible","==",true));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StoreProduct, "id">) })).filter(p=>manager || (p.public_visible===true && derivedVisibility(p))).sort((a,b)=>a.name.localeCompare(b.name,"ar")));
  });
}


export async function getPublicProduct(id:string):Promise<StoreProduct|null>{
 const ctx=ensure();if(!ctx||!/^[a-zA-Z0-9_-]{1,100}$/.test(id))return null;
 const d=await getDocFromServer(doc(ctx.db,"products",id));if(!d.exists()||d.data().public_visible!==true||!derivedVisibility(d.data()))return null;return {id:d.id,...d.data()} as StoreProduct;
}

export async function upsertProduct(product: StoreProduct): Promise<void> {
  const ctx = ensure();
  if (!ctx) throw new Error("Firebase غير مهيأ");
  if (!product.name.trim() || !Number.isFinite(product.price) || product.price<0) throw new Error("بيانات المنتج غير صحيحة");
  if (product.stock_quantity!==undefined && (!Number.isInteger(product.stock_quantity)||product.stock_quantity<0)) throw new Error("كمية المخزون لازم تكون عددًا صحيحًا غير سالب");
  const issues=reviewIssues(product);
  if(issues.length) throw new Error(issues.map(issue=>issue.message).join(" "));
  // Read the latest flag: saving an old editor must not undo a hide from another tab.
  const ref=doc(ctx.db,"products",product.id);
  await runTransaction(ctx.db,async tx=>{
    const current=await tx.get(ref);
    const owner_hidden=current.exists()?current.data().owner_hidden===true:product.owner_hidden===true;
    const {id,...data}={...product,owner_hidden,public_visible:derivedVisibility({...product,owner_hidden})};
    tx.set(ref,Object.fromEntries(Object.entries(data).filter(([,value])=>value!==undefined)));
  });
}

// A visibility-only transaction cannot change prices, medical content or approval.
export async function setProductHidden(id:string,hidden:boolean):Promise<void>{
 const ctx=ensure();if(!ctx)throw new Error("Firebase غير مهيأ");
 const ref=doc(ctx.db,"products",id);
 await runTransaction(ctx.db,async tx=>{
  const snap=await tx.get(ref);if(!snap.exists())throw new Error("المنتج لم يعد موجودًا");
  const current=snap.data();
  tx.update(ref,{owner_hidden:hidden,public_visible:derivedVisibility({...current,owner_hidden:hidden})});
 });
}

export async function deleteProductById(productId: string): Promise<void> {
  const ctx = ensure();
  if (!ctx) throw new Error("Firebase غير مهيأ");
  await deleteDoc(doc(ctx.db, "products", productId));
}

export async function seedProducts(products: StoreProduct[]): Promise<void> {
  const ctx = ensure();
  if (!ctx) throw new Error("Firebase غير مهيأ");
  await bulkImportProducts(products.map(p=>({...p,description:""})),()=>{});
}

export type PromoBanner = {
  id: string;
  title: string;
  text: string;
  imageUrl: string;
  linkUrl: string;
  linkLabel: string;
  enabled: boolean;
};
export function watchBanners(callback: (banners: PromoBanner[]) => void): Unsubscribe | null {
  const ctx = ensure();
  if (!ctx) return null;
  return onSnapshot(collection(ctx.db, "banners"), (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PromoBanner))));
}
export async function saveBanner(banner: PromoBanner): Promise<void> {
  const ctx = ensure();
  if (!ctx) throw new Error("Firebase غير مهيأ");
  const { id, ...data } = banner;
  await setDoc(doc(ctx.db, "banners", id), data);
}
export async function deleteBanner(id: string): Promise<void> {
  const ctx = ensure();
  if (!ctx) throw new Error("Firebase غير مهيأ");
  await deleteDoc(doc(ctx.db, "banners", id));
}


export async function setExpectedDelivery(orderId: string, expected_at: string | null) {
  const ctx = ensure(); if (!ctx) throw new Error("Firebase غير مهيأ");
  if (expected_at && !Number.isFinite(Date.parse(expected_at))) throw new Error("ميعاد غير صحيح");
  const ref = doc(ctx.db,"orders",orderId);
  await runTransaction(ctx.db, async (t) => {
    const order = await t.get(ref); if (!order.exists()) throw new Error("الطلب مش موجود");
    if (["delivered","cancelled"].includes(order.data().status)) throw new Error("الطلب اتقفل");
    t.update(ref,{expected_at,updated_at:new Date().toISOString(),notification_pending:true});
    if (order.data().tracking_id) t.update(doc(ctx.db,"tracking",order.data().tracking_id),{expected_at});
  });
  void requestOrderNotification(orderId);
}
export type OrderFeedback = { id: string; rating: number; comment: string; created_at: string };
export async function submitFeedback(code: string, phone: string, rating: number, comment: string) {
  const ctx = ensure(); if (!ctx) throw new Error("Firebase غير مهيأ");
  const key = await trackingKey(code,phone);
  await setDoc(doc(ctx.db,"feedback",key),{rating,comment:comment.trim().slice(0,1000),created_at:new Date().toISOString()});
}
export function watchFeedback(callback: (feedback: OrderFeedback[]) => void) {
  const ctx = ensure(); if (!ctx) return null;
  return onSnapshot(query(collection(ctx.db,"feedback"),orderBy("created_at","desc")),(snap)=>callback(snap.docs.map((d)=>({id:d.id,...d.data()} as OrderFeedback))));
}

// Each chunk is atomic. A failure reports exactly how many earlier rows committed.
export async function bulkImportProducts(products:StoreProduct[],onProgress:(saved:number)=>void){
 const ctx=ensure();if(!ctx)throw new Error("Firebase غير مهيأ");if(products.length>1000)throw new Error("قسم الملف لأجزاء حتى 1000 منتج");let saved=0;
 try {for(let i=0;i<products.length;i+=200){
  const chunk=products.slice(i,i+200),refs=chunk.map(p=>doc(ctx.db,"products",p.id));
  await runTransaction(ctx.db,async tx=>{
   const current=await Promise.all(refs.map(ref=>tx.get(ref)));
   chunk.forEach((p,n)=>{const {id,...data}=p;tx.set(refs[n],Object.fromEntries(Object.entries({...data,...importVisibility(current[n].exists()?current[n].data():undefined)}).filter(([,v])=>v!==undefined)));});
  });
  saved+=chunk.length;onProgress(saved);
 }}
 catch {throw new Error(`توقف الاستيراد بعد حفظ ${saved} من ${products.length}. الصفوف المحفوظة مسودات خاصة. راجعها قبل إعادة المحاولة، واستخدم نفس المعرفات لمنع التكرار.`);}
}

// Public appearance contains no private settings, tokens or customer data.
export function watchStoreAppearance(callback:(value:StoreAppearance)=>void,onError:()=>void):Unsubscribe|null {
 const ctx=ensure();if(!ctx){onError();return null;}
 return onSnapshot(doc(ctx.db,'store_public','appearance'),snap=>callback(parseAppearance(snap.exists()?snap.data():null)),onError);
}
export async function saveStoreAppearance(value:StoreAppearance):Promise<void> {
 const ctx=ensure(),user=ctx?.auth.currentUser;
 if(!ctx||!user||user.email!=='ahmedsheta89@gmail.com')throw new Error('manager_only');
 if(!validSeasons(value.seasonal)||!isTheme(value.theme)||typeof value.accepting_orders!=='boolean'||value.closed_message.trim().length>240)throw new Error('invalid_settings');
 await setDoc(doc(ctx.db,'store_public','appearance'),{...value,closed_message:value.closed_message.trim(),updated_at:serverTimestamp(),updated_by:user.uid});
}
