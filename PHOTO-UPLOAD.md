# Direct product photo upload

Status: local implementation with unit tests, visual checks and a disposable-emulator integration test. Not deployed and not a verified production-owner journey.

## Flow

The owner selects JPG, PNG or WebP, at most 15 MiB, 36 megapixels and 16,000 pixels on either edge. Header dimensions are checked before bitmap allocation. The browser applies orientation, flattens transparency on white and re-encodes JPEG without source metadata. Output is at most 1200 pixels on either edge and 200 KiB. Preview precedes an explicit upload action. Animated inputs become still images.

Save is disabled while a selected image is being prepared, waiting to upload or uploading. Upload failure leaves the previous URL intact. Retry and discard remain available. Discarding or leaving the editor aborts the request and prevents a late response from changing the product. Other field edits made during upload are preserved. The product must still be saved after upload.

Changing the image returns content review to unreviewed. Uploading and manually showing a product do not grant clinical or advertising approval. The existing transactional write preserves owner_hidden.

The preview has a readable failure state and manual reload button. KV propagation is not instant everywhere. An image uploaded now can take 60 seconds or more to appear in another location, including after an earlier missing-image request. The UI says so. The public image component contains the entire pack instead of cropping it.

## Worker and storage

POST /photos requires an allowed production storefront Origin, a verified Firebase owner token and a bounded JPEG body. Missing rate-limiter or KV bindings fail closed. The limit is 20 requests per minute per IP and per owner. JPEG frame and scan structure and dimensions are checked. IDs are SHA-256 hashes. Identical-byte retries reuse the existing key rather than another KV write.

GET /media/:hash is public. It returns JPEG with nosniff and sandbox CSP headers, using a canonical immutable edge-cache key. No filename, customer data or authentication token is embedded in the stored image. Successful uploads warm the local edge cache from the validated bytes. Cache failures do not undo a successful KV write or prevent a valid image response.

The configuration binds the already-created PRODUCT_PHOTOS Workers KV namespace. The store account was checked on Workers Free, with the free AI allowance visible, on November 22, 2026. This implementation does not enable Firebase Storage, Blaze, R2, a card or a paid plan. Free-quota errors return unavailable and do not change the product. Quotas are finite.

There is no automatic orphan deletion. A reference check followed by a delete across Firestore and KV is not atomic and could delete a newly linked image. Cleanup needs a separate safe lifecycle. Existing images are not deleted to make room. The order-notification cron is unchanged.

## Verification

Build and unit/regression tests:

```
npm run build
node --experimental-strip-types --test qa/photos.test.mjs qa/visibility.test.mjs qa/themes.test.mjs qa/orders.test.mjs
```

Visual and browser-format checks:

```
node qa/photos-visual.cjs
node qa/photos-formats.cjs
```

Actual-code local integration:

```
qa/node_modules/.bin/firebase emulators:exec --only auth,firestore --project demo-photo-check --config firebase.photos-testing.json 'node qa/photos-integration.cjs'
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

The integration script runs the actual Admin UI, actual client upload helper and actual Worker handler with Auth and Firestore emulators and an in-memory KV. The external token lookup is bridged to the Auth emulator and the local CORS boundary is adapted for the fixture. It signs in, uploads, saves through the product transaction, reloads and renders the persisted image bytes. Manual hiding remains true, review becomes unreviewed and public visibility remains false. This does not test a production token lookup, real KV propagation or the owner's live session.

Before release: complete independent review; recheck the exact free plan, quota, namespace and rate-limiter bindings; and validate the authenticated owner upload/save/reload journey on an approved isolated preview or owner session. Production deployment stays held. No production product mutation, image upload or deployment was performed by these local checks.

## Next stage

Bulk upload and reviewed matching are not implemented yet. Only unique exact SKU/barcode/filename matches may auto-link. Ambiguous identities, strengths and pack sizes must enter review and never silently publish. Visual AI needs a supported exact model, a verified free path and a quota limit before implementation. No paid recognition API is approved.

## Sources

- KV pricing: https://developers.cloudflare.com/kv/platform/pricing/
- KV limits: https://developers.cloudflare.com/kv/platform/limits/
- KV consistency: https://developers.cloudflare.com/kv/concepts/how-kv-works/
- Workers AI pricing: https://developers.cloudflare.com/workers-ai/platform/pricing/
- Candidate vision model: https://developers.cloudflare.com/workers-ai/models/qwen3.8-27b/
