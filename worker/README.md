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
