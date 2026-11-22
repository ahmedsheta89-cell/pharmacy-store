# Direct product photo upload

Status: local implementation with unit tests, visual checks and a disposable-emulator integration test. Not deployed and not a verified production-owner journey.

## Flow

The owner selects JPG, PNG or WebP, at most 15 MiB, 36 megapixels and 16,000 pixels on either edge. Header dimensions are checked before bitmap allocation. The browser applies orientation, flattens transparency on white and re-encodes JPEG without source metadata. Output is at most 1200 pixels on either edge and 200 KiB. Preview precedes an explicit upload action. Animated inputs become still images.

Save is disabled while a selected image is being prepared, waiting to upload or uploading. Upload failure leaves the previous URL intact. Retry and discard remain available. Discarding or leaving the editor aborts the request and prevents a late response from changing the product. Other field edits made during upload are preserved. The product must still be saved after upload.

Changing the image returns content review to unreviewed. Uploading and manually showing a product do not grant clinical or advertising approval. The existing transactional write preserves owner_hidden.

The preview has a readable failure state and manual reload button. KV propagation is not instant everywhere. An image uploaded now can take 60 seconds or more to appear in another location, including after an earlier missing-image request. The UI says so. The public image component contains the entire pack instead of cropping it.

## Worker and storage

POST /photos requires an allowed production storefront Origin, a verified Firebase owner token and a bounded JPEG body. Missing rate-limiter or KV bindings fail closed. The native guard is configured for approximately 20 requests per minute per IP and per owner within each Cloudflare location. It is not a strict global or daily quota. JPEG frame and scan structure and dimensions are checked. IDs are SHA-256 hashes. Identical bytes use the same key. An already-visible KV value avoids another write, but this is a best-effort quota optimization, not a cross-location transaction under eventual consistency.

GET /media/:hash is public. It returns JPEG with nosniff and sandbox CSP headers, using a canonical immutable edge-cache key. No filename, customer data or authentication token is embedded in the stored image. Successful uploads warm the local edge cache from the validated bytes. Cache failures do not undo a successful KV write or prevent a valid image response.

The configuration binds the already-created PRODUCT_PHOTOS Workers KV namespace. The store account was checked on Workers Free, with the free AI allowance visible, on November 22, 2026. This implementation does not enable Firebase Storage, Blaze, R2, a card or a paid plan. Free-quota errors return unavailable and do not change the product. Quotas are finite.

There is no automatic orphan deletion. A reference check followed by a delete across Firestore and KV is not atomic and could delete a newly linked image. Cleanup needs a separate safe lifecycle. Existing images are not deleted to make room. The order-notification cron is unchanged.

## Verification

Build and unit/regression tests:

```
npm run build
node --experimental-strip-types --test qa/photo-queue.test.mjs qa/photo-matching.test.mjs qa/photos.test.mjs qa/visibility.test.mjs qa/themes.test.mjs qa/orders.test.mjs
```

Visual and browser-format checks:

```
node qa/photos-visual.cjs
node qa/photos-formats.cjs
node qa/bulk-photos-visual.cjs
```

Actual-code local integration:

```
qa/node_modules/.bin/firebase emulators:exec --only auth,firestore --project demo-photo-check --config firebase.photos-testing.json 'node qa/photos-integration.cjs'
qa/node_modules/.bin/firebase emulators:exec --only auth,firestore --project demo-photo-check --config firebase.photos-testing.json 'node qa/bulk-photos-integration.cjs'
```

Rules/data-layer regression:

```
qa/node_modules/.bin/firebase emulators:exec --only firestore --project demo-theme-check --config firebase.themes-testing.json 'node --experimental-strip-types --test qa/rules.test.mjs qa/product-emulator.test.mjs'
```

Worker bundle validation:

```
wrangler deploy --config worker/wrangler.jsonc --dry-run
```

The visual script starts and stops a local fixture server, blocks production requests and uses synthetic art and transport. It checks 320/390/1280px, save gating, upload retry after quota failure, preservation of edits and the previous URL, metadata removal, dimensions, success messaging, review reset, discard, invalid formats, whole-image rendering, and delayed-preview failure/retry.

The formats script covers ordinary JPEG, EXIF rotation, lossy/lossless/animated WebP, transparency on white, high-texture compression, discard during upload and leaving the editor during upload.

The integration script runs the actual Admin UI, actual client upload helper and actual Worker handler with Auth and Firestore emulators and an in-memory KV. The browser's Firebase SDK is deduplicated to the production version and asserted by the test. The external token lookup is bridged to the Auth emulator and the local CORS boundary is adapted for the fixture. It signs in, uploads, saves through the product transaction, reloads and renders the persisted image bytes. Manual hiding remains true, review becomes unreviewed and public visibility remains false. This does not test a production token lookup, real KV propagation or the owner's live session.

Before release: complete independent review; recheck the exact free plan, quota, namespace and rate-limiter bindings; and validate the authenticated owner upload/save/reload journey on an approved isolated preview or owner session. Production deployment stays held. No production product mutation, image upload or deployment was performed by these local checks.

## Reviewed bulk workflow

The bulk review UI is implemented locally. Its matching accepts a full filename-to-ID match only when both the normalized code and target are unique. Workbook SKU/barcode aliases currently map to that document ID. Leading zeros, suffixes, strength and pack numbers are not discarded. Case-fold collisions, duplicate files for one target, unsafe filenames and name hints cannot auto-link. Name suggestions are review hints, not recognition results.

The image-only assignment transaction checks the selected product identity, previous image and image revision against current data. It updates only the image and review/public flags, preserves concurrent prices/stock/content/hiding, rejects a changed image or pack, and never recreates a deleted product. An already-applied retry preserves a later human review. Product reads take their ID from the document, not a conflicting legacy payload field. These paths have unit and actual data-layer emulator coverage. Revisions detect app-controlled remove/readd of the same URL and deletion/recreation. Full-editor saves reject a newer image revision; price-only updates and workbook imports preserve it. Direct writes outside these application paths that omit revision metadata are not a universal history guarantee.

The owner can prepare up to 50 files and 250 MiB locally, inspect 256px thumbnails and full normalized previews, explicitly review manual matches and replacements, then upload/link eligible rows sequentially. Selection sends nothing. Duplicate targets and stale identities/images are blocked. A known uploaded URL is reused after a failed save or reviewed retarget. The first error stops later rows without undoing earlier saves. Stop/unmount prevents future rows, but an already-started Firestore commit may finish. Clearing the queue does not delete uploaded bytes.

At the November 22 local checkpoint, the build, 58 unit/backend checks, 20 rules/data-layer checks, both actual-code integrations and the browser visual/format/cancellation suites passed. The three-row integration used production Firebase SDK 11.10.0, actual Admin/client/Worker/transactions, disposable Auth/Firestore and in-memory KV. It verified concurrent price/stock/description preservation, manual hiding, a stale row held for review, unreviewed/nonpublic image changes and all three images rendered again after reload. This is not production-owner QA. See `BULK-PHOTOS.md` for the behavior and remaining release gate.

Ambiguous identities, strengths and pack sizes must enter review and never silently publish. The exact Qwen model schema and Free REST image path are now verified. Three independent synthetic-image calls succeeded, reporting 188.1727 neurons in total: two distinct clear strengths/counts were read correctly, and an unreadable image returned unknown fields. This proves the image route works, not real medicine-pack accuracy or a store vision feature. The current bulk UI still uses deterministic matching and manual review only. Before visual assistance is integrated, representative-pack quality and an explicit shared-quota budget still need checking. No paid recognition API is approved. See `VISION-FEASIBILITY.md` for the measured evidence, exact sources and remaining limits.

## Sources

- Workers rate-binding semantics: https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
- Workers pricing: https://developers.cloudflare.com/workers/platform/pricing/
- KV pricing: https://developers.cloudflare.com/kv/platform/pricing/
- KV limits: https://developers.cloudflare.com/kv/platform/limits/
- KV consistency: https://developers.cloudflare.com/kv/concepts/how-kv-works/
- Workers AI pricing: https://developers.cloudflare.com/workers-ai/platform/pricing/
- Candidate vision model: https://developers.cloudflare.com/workers-ai/models/qwen3.8-27b/
