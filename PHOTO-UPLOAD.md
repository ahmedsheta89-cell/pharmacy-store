# Direct product photo upload

Status: local implementation and synthetic QA. Not deployed or represented as a verified live owner journey.

## Flow

Owner selects JPG, PNG or WebP, at most 15 MiB and 36 megapixels. The browser checks header dimensions before allocating a bitmap, applies image orientation, flattens transparency on white and re-encodes JPEG without source metadata. Output is at most 1200 pixels on either edge and 200 KiB. Preview precedes the explicit upload action. Animated inputs become still images.

Save is disabled while a selected image is pending. Failed upload leaves the previous product URL intact; the owner can retry or discard the pending image. Upload cancellation and component unmount abort the transport. Changes made to other product fields while upload is in flight are preserved. The product still needs saving after upload.

Changing the product image returns content review to unreviewed. Neither upload nor manual show grants clinical or advertising approval. Existing owner_hidden state stays under the current transactional product-write logic.

## Worker and storage

POST /photos accepts only the production storefront Origins, a verified Firebase owner token and a bounded JPEG body. Both the native rate limiter and KV binding must exist, otherwise writes fail closed. Upload rate is 20 per minute per IP and per owner. JPEG frame/scan headers and dimensions are checked. IDs are SHA-256 hashes. Retrying identical bytes reuses the same key instead of consuming another KV write.

GET /media/:hash is public, as product images are intended for customers. It returns JPEG, nosniff and sandbox CSP headers, with a canonical immutable edge-cache key. No filename, customer information or authentication token is stored in the image metadata.

This uses the already-created PRODUCT_PHOTOS Workers KV namespace under the verified Free plan. It does not activate Firebase Storage, Blaze, R2 or any paid plan. Free quota errors return unavailable and do not change the product. Existing images are not deleted to make room. Quotas are not unlimited.

Automatic orphan deletion is deliberately absent. A Firestore-reference check followed by KV deletion is not atomic and could delete an image linked between those operations. A future cleanup needs a separate safe lifecycle, not a best-effort destructive cron. The existing order-notification cron is unchanged.

## Verification

- npm run build
- node --experimental-strip-types --test qa/photos.test.mjs qa/visibility.test.mjs qa/themes.test.mjs qa/orders.test.mjs
- node qa/photos-visual.cjs
- wrangler deploy --config worker/wrangler.jsonc --dry-run

Photo visual QA starts and stops a local fixture server, blocks production requests, and uses synthetic product art and synthetic upload transport. It checks 320/390/1280px, preview and save gating, quota error/retry, preservation of other edits, metadata stripping, image dimensions, success messaging, review reset, discard, invalid types and whole-image containment. That is not a live authenticated upload or a full product save/reload test.

Before release: finish independent review, run full regression/emulator checks, validate the actual staging/owner upload and persisted product journey, recheck free plan/quota/bindings, and keep production deployment held until live verification passes. No production upload, owner data mutation or deployment was performed by this implementation.

## Next stage

Bulk upload and reviewed matching are not implemented. Unique exact SKU/barcode/filename matches may auto-link. Ambiguous identities, strengths and pack sizes must enter review, never silently publish. Any visual AI first needs a verified free supported model and quota. No paid recognition API is approved.
