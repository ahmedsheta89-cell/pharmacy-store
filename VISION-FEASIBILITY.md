# Free vision feasibility checkpoint

November 22, 2026. Research proof only. No visual-AI feature is connected to the store, and no production deployment or product mutation was made.

## What is established

The store account's exact `@cf/qwen/qwen3.8-27b` schema was read successfully. Its user messages accept an array containing text and `image_url` parts, with an image URL and optional detail setting. The official model announcement supports image/text input through either the Workers AI binding or REST API.

The authenticated account still showed Workers Free as the current $0 plan at 07:35 Cairo. Its AI usage view showed 94.6 of 10,000 daily neurons before this test. The pricing page lists this Qwen model and does not include it among the models that require a paid billing method. Workers Free does not authorize overage charges: further operations fail when the free allowance is exhausted. The allowance is shared with the existing chat and resets at 00:00 UTC.

Three independent image requests then succeeded with HTTP 200 through the store account's authenticated REST endpoint. Each used synthetic artwork only, the same transcription prompt, inline JPEG data, low image detail, low reasoning effort, temperature zero and a maximum of 192 completion tokens. The prompt did not contain the printed label values. No new grant, model license, card, plan upgrade or AI Gateway credits were added.

| Synthetic input | Checked result | Reported neurons |
| --- | --- | --- |
| Clear carton A | Printed code, 125 mg strength and 18-tablet count matched exactly | 58.8455 |
| Same code, different clear carton B | Printed 250 mg strength and 30-tablet count matched exactly | 68.1545 |
| Deliberately unreadable carton | All identity/strength/count fields were null, with an unclear flag | 61.1727 |

Total usage reported by the three inference responses was 188.1727 neurons. This is measured test usage, not a promise about the cost of future photos. The later dashboard total was not re-polled, so do not present a calculated dashboard total as an observed one.

## What is not established

This is a small best-case English-artwork check, not an accuracy benchmark. It does not validate real medicine packs, Arabic or mixed-language labels, glare, rotation, cropped strength/pack details, several cartons in one photo, or alignment with the owner's actual catalog. A correct transcription is not proof of product identity. A model can still invent plausible text on other images.

The test used the REST API, not a deployed Worker vision route. It does not verify a production UI, Worker AI request handling, owner acceptance or a full 50-image recognition workflow. No real customer, prescription or product photo was sent. The released local bulk UI still performs deterministic filename-to-ID matching and explicit manual review only.

## Safe next stage

Keep all model-derived text and candidate matches in a clearly labeled review queue. Never let visual confidence auto-link a pack, approve clinical content or publish a product. Exact unique full filename-to-ID matches remain a separate deterministic path.

Before integrating visual assistance, evaluate representative photographed packs against known catalog identities and design an explicit shared-quota budget, bounded requests, strict response parsing and failure behavior. Do not promise a fixed number of free images from this three-image sample. Production-owner upload/save/reload QA and the release gate in `PHOTO-UPLOAD.md` remain open.

## Sources

- Exact model: https://developers.cloudflare.com/workers-ai/models/qwen3.8-27b/
- Image/text support announcement: https://developers.cloudflare.com/changelog/post/2026-08-17-qwen-3.8-27b-workers-ai/
- Model-schema endpoint and parameters: https://developers.cloudflare.com/api/resources/ai/subresources/models/subresources/schema/methods/get/
- Inference endpoint: https://developers.cloudflare.com/api/resources/ai/methods/run/
- Free allocation, model rates and paid-only exceptions: https://developers.cloudflare.com/workers-ai/platform/pricing/
- Service limits: https://developers.cloudflare.com/workers-ai/platform/limits/
- Authenticated current plan: https://dash.cloudflare.com/996f291849de336a2d6a75925d7f5a07/workers/plans
- Authenticated pre-test usage: https://dash.cloudflare.com/996f291849de336a2d6a75925d7f5a07/ai/workers-ai/usage

Evidence includes first-party policy/model/API references, authenticated account views, the exact account model schema and the three empirical synthetic requests. No independent real-pack quality evaluation is claimed.
