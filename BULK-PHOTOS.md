# Reviewed bulk product photos

Status: implemented and tested locally, including the actual UI/client/Worker/data-layer path with disposable Auth and Firestore emulators. Not pushed, deployed or verified in the owner's production session. This is not a release claim.

## Existing foundations

- `productPhotoMatching.ts`: conservative exact filename-to-ID planning, review-only name hints, duplicate/collision checks, display sanitization and identity snapshots.
- Workbook SKU/code/barcode aliases currently map to the product document ID. There is no separate barcode column in the product model.
- `assignProductPhoto`: a Firestore image-only transaction with previous-image and identity preconditions. It preserves other current fields, resets content review/public visibility, rejects deleted/changed products and treats an already-applied retry as a no-op.
- `compressProductPhoto`: metadata-free, oriented, white-backed JPEG, at most 1200px and 200 KiB, bounded input dimensions.
- `uploadProductPhoto`: authenticated native uploader, timeout/cancellation, pinned returned URL and finite free storage.

## Queue UI

`BulkProductPhotos` is inside the products panel, separate from a single product's editor. The following behavior is implemented locally.

1. Explicitly open the batch panel and select files. Selection prepares images locally, it does not upload or save.
2. Start with at most 50 files and a bounded total input size. Read and compress serially, not with an unbounded Promise.all.
3. Each row has its source File, prepared upload Blob, small thumbnail URL, optional full preview URL, matching result, selected product ID, expected image URL, expected identity, review confirmation, uploaded URL and progress/error state.
4. Generate small thumbnails rather than decoding fifty full-size images for the queue. Full normalized preview opens only on request. Do not retain original-file bitmap allocations.
5. Show separate counts for prepared, exact-code matches, review needed, invalid, saved and failed. Do not label a local preview as uploaded.
6. Exact unique ID matches may be preselected. Name hints, unknown names, ambiguous codes and duplicate file targets remain unselected/review-only.
7. Give manual product search and a bounded result selector. Show the complete product name/code and pack/unit, not a shortened medicine label. Changing the selection resets its review confirmation and snapshots current identity/image.
8. Require per-row review for manual choices and explicit replacement confirmation when the selected product already has an image. Confirm strength and pack size, not only brand.
9. Never allow two active rows to target one product, including after manual choices. A completed row still reserves its target within this batch. Skipped/invalid rows do not.
10. If the live catalog changes a selected image or identity, make that row ineligible. Provide an explicit refresh-and-review action. A price/stock change alone must not invalidate identity or be overwritten.
11. Show the public-link privacy warning and a clear statement that assigning a changed image returns the product to review and may hide it until reapproval. No private/customer/prescription images.

## Upload and save

- The owner explicitly starts eligible rows. No upload-on-selection or silent publication.
- Run one image at a time, with about 3.5 seconds between upload starts. The configured native guard is approximately 20 requests per minute per IP and owner within each Cloudflare location, not a strict global or daily quota. The provider remains the final quota/rate authority. Do not promise the whole daily free allowance to this feature.
- Validate against the latest catalog before each row; the transaction checks again at commit.
- Upload, retain the returned URL, then call the image-only assignment. Never bulk-save stale complete product objects.
- Stop the batch on an upload/save failure rather than hammering quota/auth errors. Keep earlier saved rows and each returned upload URL.
- Retrying a save with a known uploaded URL does not upload it again. Retargeting after an explicit review can reuse that normalized image.
- Provide an honest stop action: abort an active fetch and prevent further rows, but a Firestore commit already in flight can still finish. Do not promise rollback. Report any row that did save.
- Leaving the panel aborts preparation/uploads and prevents later rows. Do not silently continue an unattended batch. An in-flight product commit is not cancellable.
- Clearing the client queue does not delete uploaded bytes or undo saved links. No automatic orphan deletion.
- Re-selecting the same files after a refresh can safely reuse content hashes; already-linked assignments are idempotent and must not undo a later human review.

## Component lifecycle

Use generation/cancellation guards and a mounted flag. Track all created object URLs explicitly; revoke individual removed rows, then all remaining URLs on clear/unmount. Do not revoke previews on every queue state update.

Disable other product mutations/import controls while the batch is preparing/running, or make their navigation behavior explicit. A tab change/unmount stops further batch work. A currently committing transaction may finish.

Keep user-visible Arabic RTL readable at 320/390/1280px, with contained pack previews, no filename overflow, clear phases and useful failure/retry text. Product search results and filenames are data, never markup or instructions.

## Acceptance checks

- 50-file and total-size limits reject cleanly, without partial accidental uploads.
- Serial preparation, thumbnail/full-preview bounds and URL cleanup.
- Exact ID with leading zeros; no stripping of strength, suffix or pack numbers.
- Duplicate filenames/targets and catalog case-fold collisions never auto-pick.
- Manual hints never count as exact matches; number conflicts do not suggest the wrong pack.
- Replacement and manual-review confirmations; ambiguous rows never enter the upload set accidentally.
- Catalog rename, changed image and deletion during review; price/stock change during the batch.
- Upload failure, quota/rate error, auth expiry and save failure after a successful upload.
- Retry uses the known URL, preserves prior successes and cannot recreate a deleted product.
- Stop during preparation, upload, pacing and an already-started save; leaving the panel.
- No late writes after cancellation apart from an honestly reported commit already in flight.
- Actual UI + actual client/helper/Worker + disposable Auth/Firestore services + in-memory KV for several-row save/reload.
- Visual inspection at all three widths, including review, replacement, error, stop and partial-success states.

## Verified local checkpoint, November 22, 2026

- Production build passes, with the existing large main/Excel chunk warning.
- 58 unit/backend checks and 20 Firestore rules/data-layer checks pass.
- Synthetic browser checks cover all three widths, review/replacement consent, duplicate targets, bounded 50-image preparation, failure recovery, URL reuse, catalog conflicts, pacing, stop/unmount and object-URL cleanup.
- Both single-image and three-row bulk actual-code integrations pass with production Firebase SDK 11.10.0. Three different images were saved and rendered again after reload through the actual media handler. A stale third-row image was blocked until refreshed and reviewed. Concurrent price, stock and description changes and manual hiding survived.
- Image revisions detect app-controlled remove/readd of the same URL, deletion/recreation and stale full-editor overwrites. Price-only edits and workbook imports preserve the revision; changed images receive a new revision. An already-applied photo retry does not undo a later human review. Direct out-of-band writes that omit this metadata are not a universal history guarantee.
- Local visual evidence includes review, replacement, stale, stopped, saved and actual-code reload states. External token lookup and local CORS are bridged for the emulator fixture. This is not evidence of production authentication, real KV propagation or the owner's live journey.

See `PHOTO-UPLOAD.md` for reproducible commands and release checks. The rate-binding semantics are documented at https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/.

## Release gate

The local hosting workflow currently deploys only a push to main or manual dispatch. Recheck the live workflow before relying on a branch push being non-deploying. Do not merge or manually deploy as a side effect of this work. Production-owner photo QA remains open. A Hosting preview alone must not be called an isolated backend: verify its Firebase/Worker targets and allowed Origin before offering that route. Do not bypass the stale manager password or change authentication to get a test pass.

Visual AI remains a separate optional step. Exact Qwen vision capability is documented, but no image inference has run on the store's Free binding. The current official playground has no image attachment input. Do not claim image recognition is built, accept a new model license, enable billing or send private images.
