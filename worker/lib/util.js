// Pure helpers shared by the Worker routes and the test suite. No I/O here.

export const ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'; // 55 chars

// Random document ids. Index with alphabet.length: a larger modulo can emit
// undefined chars (the original %57 bug) which downstream id regexes reject.
export function rid(prefix, n = 20) {
  const rnd = crypto.getRandomValues(new Uint8Array(n));
  let s = '';
  for (let i = 0; i < n; i++) s += ID_ALPHABET[rnd[i] % ID_ALPHABET.length];
  return prefix + '-' + s;
}

// Customer access tokens: rejection sampling removes modulo bias on a secret.
export function token24() {
  const L = ID_ALPHABET.length;
  const max = 256 - (256 % L);
  const out = [];
  while (out.length < 24) {
    for (const b of crypto.getRandomValues(new Uint8Array(32))) {
      if (b < max) out.push(ID_ALPHABET[b % L]);
      if (out.length === 24) break;
    }
  }
  return out.join('');
}

const enc = new TextEncoder();
export async function sha256hex(v) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(v)))]
    .map((x) => x.toString(16).padStart(2, '0')).join('');
}

export const normalizePhone = (v) =>
  String(v).replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[^0-9]/g, '').replace(/^(0020|20)/, '').replace(/^0/, '');

export const isEgyptianMobile = (normalized) => /^1[0125][0-9]{8}$/.test(normalized);

// Store order lifecycle. Keep in sync with the store app's allowed transitions.
export const ORDER_TRANSITIONS = {
  new: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'out_for_delivery', 'delivered', 'cancelled'],
  preparing: ['out_for_delivery', 'cancelled'],
  out_for_delivery: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};
export const canTransition = (from, to) => (ORDER_TRANSITIONS[from] || []).includes(to);

export const ORDER_EVENT_TEXT = {
  new: 'طلبك اتسجل عندنا',
  confirmed: 'طلبك اتأكد',
  preparing: 'طلبك بيتجهز',
  out_for_delivery: 'طلبك خرج للتوصيل',
  delivered: 'طلبك اتسلم',
  cancelled: 'طلبك اتلغى',
};

export const CONV_ID_RE = /^conv-[A-Za-z0-9]{16,24}$/;
// Client-generated session tokens (24-64 chars) or server-issued recovery tokens.
export const TOKEN_RE = /^[A-Za-z0-9_-]{24,64}$/;
// Client-supplied idempotency keys (UUIDs generated in the browser): one for the
// conversation (first send), one per message. Retries reuse them, so a lost
// response can never duplicate a conversation or a message.
export const CLIENT_MSG_RE = /^[0-9a-f-]{36}$/i;
export const CLIENT_CONV_RE = /^[0-9a-f-]{36}$/i;

export const LIMITS = { message: 2000, note: 2000, name: 100, tags: 20 };

// documents.list returns {documents:[...]}; runQuery rows use {document}. A
// single parser keeps the two shapes from leaking empty reads (review finding 1).
export function parseDocList(listed) {
  const rows = listed?.documents || [];
  return rows.map((d) => ({ id: d.name.split('/').pop(), fields: d.fields || {}, updateTime: d.updateTime }));
}


// Stable JSON for replay binding. Only JSON request data is accepted upstream.
export function canonical(value) {
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value!==null&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
 return JSON.stringify(value);
}
export const payloadHash = value => sha256hex(canonical(value));
