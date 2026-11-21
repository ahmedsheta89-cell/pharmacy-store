/**
 * Shared CRM schema for One For All Good.
 * Used by the store widget (store repo), the CRM app (crm/), and mirrored in worker/crm.js.
 * Keep field names snake_case to match Firestore documents and the existing store code.
 */

export const CHANNELS = ["store", "messenger", "instagram", "whatsapp"] as const;
export type Channel = (typeof CHANNELS)[number];

export const CONVERSATION_STATUSES = ["open", "pending", "resolved", "snoozed"] as const;
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];

export type MessageSender = "customer" | "agent" | "system" | "ai";
export type MessageKind = "text" | "note" | "order_event";

export const STAFF_ROLES = ["owner", "admin", "agent"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

/** Normalize an Egyptian mobile the same way the store does: digits only, no country code, no leading 0. */
export function normalizePhone(value: string): string {
  return value
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[^0-9]/g, "")
    .replace(/^(0020|20)/, "")
    .replace(/^0/, "");
}

export function isValidEgyptianMobile(normalized: string): boolean {
  return /^1[0125][0-9]{8}$/.test(normalized);
}

/** customers/{customerKey}: customerKey = sha256(normalizedPhone) when a phone is known, else "anon-<uuid>". */
export type Customer = {
  name: string;
  phone: string | null; // staff-readable only
  tags: string[];
  order_ids: string[];
  notes: string;
  first_seen: string; // ISO
  last_seen: string; // ISO
};

export type Conversation = {
  last_seq: number;
  waiting_since: string | null;
  channel: Channel;
  status: ConversationStatus;
  customer_key: string;
  customer_name: string; // display snapshot
  customer_token_hash: string; // sha256 of the customer's access token; the token itself is only ever held by the customer's browser
  assignee_uid: string | null;
  department_id: string | null;
  tags: string[];
  order_ids: string[];
  preview: string; // last message snippet for the inbox list
  created_at: string;
  last_message_at: string;
  last_inbound_at: string | null; // last customer message; drives response metrics
  first_response_seconds: number | null; // set once, on the first agent reply
  response_count: number; // agent replies while awaiting staff
  response_seconds_total: number; // sum of per-reply response times (avg = total / count)
  awaiting: "staff" | "customer" | "none";
  snoozed_until: string | null;
};

export type ConversationMessage = {
  seq: number;
  sender: MessageSender;
  sender_uid: string | null; // staff uid for agent/ai messages
  kind: MessageKind; // "note" is internal-only; never returned on the customer read path
  body: string;
  order_id: string | null;
  created_at: string;
};

export type StaffMember = {
  name: string;
  email: string;
  role: StaffRole;
  departments: string[];
  active: boolean;
  created_at: string;
};

export type Department = { name: string; sort: number };

export type SavedReply = {
  title: string;
  body: string;
  department_id: string | null; // null = global
};

/** agent_metrics/{uid}/days/{yyyy-mm-dd} */
export type AgentDayMetrics = {
  handled: number; // agent replies sent
  resolved: number;
  first_response_seconds_total: number;
  first_response_count: number;
  response_seconds_total: number;
  response_count: number;
};

export type AuditEntry = {
  uid: string;
  action: "view" | "reply" | "note" | "assign" | "status" | "tag" | "export";
  conversation_id: string | null;
  detail: string;
  at: string;
};

/** conversations/{id}/presence/{uid} */
export type Presence = { state: "viewing" | "typing"; at: string };

export const LIMITS = {
  messageMax: 2000,
  customerNameMax: 100,
  noteMax: 2000,
  savedReplyBodyMax: 2000,
  tagsPerConversation: 20,
} as const;

/** Order lifecycle label -> Arabic timeline text for order_event messages. */
export const ORDER_EVENT_TEXT: Record<string, string> = {
  new: "طلبك اتسجل عندنا",
  confirmed: "طلبك اتأكد",
  preparing: "طلبك بيتجهز",
  out_for_delivery: "طلبك خرج للتوصيل",
  delivered: "طلبك اتسلم",
  cancelled: "طلبك اتلغى",
};
