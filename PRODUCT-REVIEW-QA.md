# Product-review validation fix

## Findings

The existing owner approve control is already in Products > Edit > Product card and pre-publication review > Data-review status. A complete valid review saved successfully with the unmodified production code in isolated Auth/Firestore, and the product appeared through the anonymous storefront query. No general save-path failure was reproduced.

An incomplete approved review produced a generic four-field error only after submit. An approved review with a future date was incorrectly accepted. The exact error from the user's unsaved phone attempt is not available, so it must not be described as a confirmed backend failure or a confirmed missing-field case.

## Fix

- Each required review field has its own message before submit.
- Choosing approved makes source, reviewer, review date and data version required. Browser validation focuses the first incomplete field.
- Approved reviews reject future or invalid dates in the form and actual client save helper.
- The date limit uses the Cairo calendar day. It relies on the client clock; this is not a new server-side security boundary. Firestore rules are unchanged.
- Draft saves remain possible without claiming review or publication.
- No metadata is invented, auto-approved or silently corrected. Existing advertising/classification/manual-hide gates are unchanged.

## Verification

- Production build passes, with the existing large-bundle warning.
- 28 unit/regression checks pass: 8 new review checks plus orders, themes and visibility.
- Real Admin and Firebase SDK 11.10.0 tested with disposable local Auth/Firestore and the current rules, without production transport.
- Missing fields and a future date are shown before submit. Failed saves leave the document unchanged.
- Complete review saves and appears through a separate anonymous storefront.
- Direct client save-helper calls also reject missing metadata/future dates without writing.
- Description edits still revoke review; manual hiding still wins.
- 320/390/1280 widths tested for overflow and inspected visually.

Run:

```sh
npm run build
node --test qa/product-review.test.mjs qa/orders.test.mjs qa/themes.test.mjs qa/visibility.test.mjs
qa/node_modules/.bin/firebase emulators:exec --only auth,firestore --project demo-review-check --config firebase.qa.json 'node qa/product-review-integration.cjs'
```

The integration test needs Chrome, Playwright and Firebase emulator dependencies. It creates only disposable synthetic emulator records. An authenticated live owner save has not been performed: the owner must use his own signed-in session and genuine review data after release. The deployment/public-bundle check is separate from that owner verification.
