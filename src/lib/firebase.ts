import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getFirestore, arrayUnion, runTransaction, collection, getDoc, getDocFromServer, setDoc, deleteDoc, writeBatch, serverTimestamp, query, orderBy,
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
    if (!response.ok) throw new Error(result.error==="price_changed"?"سعر منتج اتغير. حدث المتجر وراجع إجمالي السلة قبل التأكيد.":response.status===429?"استنى دقيقة قبل إرسال طلب جديد.":"تعذر إرسال الطلب. راجع البيانات وجرب تاني، أو كلم الصيدلية.");
    sessionStorage.removeItem("pending-order");
    return {ok:true,orderCode:result.orderCode};
  } catch(error) {return {ok:false,reason:"error",message:error instanceof Error?error.message:"تعذر إرسال الطلب"};}
}
async function requestOrderNotification(orderId:string) {
  const ctx=ensure();const user=ctx?.auth.currentUser;if(!user)return;
  try {await fetch("https://oneforallgood-assistant.oneforallgood-store.workers.dev/notify",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+await user.getIdToken()},body:JSON.stringify({order_id:orderId})});}catch{}
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
};

export function watchProducts(callback: (products: StoreProduct[]) => void): Unsubscribe | null {
  const ctx = ensure();
  if (!ctx) return null;
  const q = query(collection(ctx.db, "products"), orderBy("name"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StoreProduct, "id">) })));
  });
}

export async function upsertProduct(product: StoreProduct): Promise<void> {
  const ctx = ensure();
  if (!ctx) throw new Error("Firebase غير مهيأ");
  const { id, ...data } = product;
  await setDoc(doc(ctx.db, "products", id), Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)));
}

export async function deleteProductById(productId: string): Promise<void> {
  const ctx = ensure();
  if (!ctx) throw new Error("Firebase غير مهيأ");
  await deleteDoc(doc(ctx.db, "products", productId));
}

export async function seedProducts(products: StoreProduct[]): Promise<void> {
  const ctx = ensure();
  if (!ctx) throw new Error("Firebase غير مهيأ");
  const batch = writeBatch(ctx.db);
  for (const product of products) {
    const { id, ...data } = product;
    batch.set(doc(ctx.db, "products", id), data);
  }
  await batch.commit();
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
