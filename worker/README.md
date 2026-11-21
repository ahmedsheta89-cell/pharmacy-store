# Free store assistant

The frontend calls the public Worker endpoint. No model credentials are shipped to the browser.

- Worker: `oneforallgood-assistant`
- Cloudflare Workers Free only. Never upgrade this account or enable paid overages without the owner's approval.
- Workers AI binding: `AI`; current model `@cf/qwen/qwen3.8-27b`.
- Predictable FAQs are answered locally. General store questions use AI, with a deterministic contact fallback if the model or free allowance is unavailable.
- The endpoint does not read customer orders, names, phones, addresses or medicine purchases. Chat is not saved by this code. The UI warns visitors not to send personal or health data.
- Medical advice, diagnosis and dosage requests are outside the assistant's scope.
- Allowed browser origins are the two Firebase Hosting domains. Origin filtering is not authentication. The endpoint is public and uses an approximate 8/minute/IP Cloudflare rate-limit binding plus an in-memory fallback. Daily account quotas remain a hard limit on the Free plan.
- Model replies are plain React text, never HTML.

Deploy from this directory using an authorized Cloudflare Wrangler login and `wrangler deploy`. Auth tokens belong outside the repository. The rate-limit namespace is dedicated to chat. No secret belongs in this configuration.

Official references:
- https://developers.cloudflare.com/workers-ai/platform/pricing/
- https://developers.cloudflare.com/workers-ai/models/qwen3.8-27b/
- https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
- https://developers.cloudflare.com/workers/platform/limits/

## Order security and notification bridge

`POST /orders` reads product names and prices from Firestore. It rejects empty carts,
unknown/duplicate products, noninteger quantities, invalid Egyptian mobile numbers,
changed totals and oversized input. Client prices/names are never saved. Request UUIDs
make lost-response retries idempotent. A separate 3/minute/IP binding limits submissions.
Direct public order/tracking creation is disabled by Firestore rules after rollout.

Required encrypted Worker secrets (never in git): `FIREBASE_SERVICE_ACCOUNT` and
`BREVO_API_KEY`. The service identity has `roles/datastore.user` only. The Brevo key
is restricted to transactional email. Both services remain on their free plans.

Notifications go only to the configured Instinct bridge mailbox and include order code,
status, total, ETA and the manager URL. No names, phones, addresses, notes or product
lists are sent. New orders and authenticated manager changes trigger a send immediately.
A 10-minute scheduled sweep retries pending sends and checks late active orders.
The sweep processes up to 100 active orders plus 100 pending sends per pass, a deliberate
free-quota bound. It is not a guarantee of instant overdue alerts or unlimited volume.
Brevo Free allows 300 emails/day; failures remain pending for retry. Gmail senders may
be rewritten by Brevo for authentication. Email receipt can lag provider acceptance.
Concurrent sends use optimistic locking. An ambiguous external send can rarely duplicate
an alert; codes make duplicates recognizable. The key expires in one year or after 90 days
unused, so expiry needs renewal rather than a paid upgrade.

The browser is not involved in scheduled notifications. The manager panel is still live
while open; optional sound depends on browser consent and audio settings.
