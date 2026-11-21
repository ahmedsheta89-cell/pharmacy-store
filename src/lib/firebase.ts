import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getFirestore, collection, getDoc, getDocFromServer, setDoc, deleteDoc, writeBatch, serverTimestamp, query, orderBy,
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
  status: "new" | "confirmed" | "delivered" | "cancelled";
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

function orderCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(12)), (n) => alphabet[n & 31]).join("");
}

export type OrderTracking = { status: StoreOrder["status"]; total: number; created_at: string };

export async function lookupOrder(code: string, phone: string): Promise<OrderTracking | null> {
  const ctx = ensure();
  if (!ctx) throw new Error("Firebase غير مهيأ");
  const snap = await getDocFromServer(doc(ctx.db, "tracking", await trackingKey(code, phone)));
  if (!snap.exists()) return null;
  const data = snap.data();
  return { status: data.status, total: data.total, created_at: data.created_at };
}

export async function placeOrder(payload: OrderPayload): Promise<PlaceOrderResult> {
  const ctx = ensure();
  if (!ctx) return { ok: false, reason: "not_configured" };
  const code = orderCode();
  try {
    const orderRef = doc(collection(ctx.db, "orders"));
    const trackingId = await trackingKey(code, payload.customer_phone);
    const created_at = new Date().toISOString();
    const batch = writeBatch(ctx.db);
    batch.set(orderRef, {
      ...payload, code, tracking_id: trackingId, status: "new", created_at,
      created_server: serverTimestamp(),
    });
    // This separate record deliberately contains no name, address, phone or medicines.
    batch.set(doc(ctx.db, "tracking", trackingId), {
      order_id: orderRef.id, status: "new", total: payload.total, created_at,
    });
    await batch.commit();
    return { ok: true, orderCode: code };
  } catch (error) {
    return { ok: false, reason: "error", message: error instanceof Error ? error.message : "unknown" };
  }
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
  const order = await getDoc(orderRef);
  const batch = writeBatch(ctx.db);
  batch.update(orderRef, { status });
  const trackingId = order.data()?.tracking_id;
  if (trackingId) batch.update(doc(ctx.db, "tracking", trackingId), { status });
  await batch.commit();
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
