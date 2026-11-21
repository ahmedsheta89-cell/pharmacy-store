import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getFirestore, collection, addDoc, serverTimestamp, query, orderBy,
  onSnapshot, updateDoc, doc, type Firestore, type Unsubscribe,
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

function orderCode(): string {
  const stamp = Date.now().toString(36).toUpperCase().slice(-4);
  const rand = Math.floor(Math.random() * 1296).toString(36).toUpperCase().padStart(2, "0");
  return `H${stamp}${rand}`;
}

export async function placeOrder(payload: OrderPayload): Promise<PlaceOrderResult> {
  const ctx = ensure();
  if (!ctx) return { ok: false, reason: "not_configured" };
  const code = orderCode();
  try {
    await addDoc(collection(ctx.db, "orders"), {
      ...payload,
      code,
      status: "new",
      created_at: new Date().toISOString(),
      created_server: serverTimestamp(),
    });
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
  await updateDoc(doc(ctx.db, "orders", orderId), { status });
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
