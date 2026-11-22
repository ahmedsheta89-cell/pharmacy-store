# Product show / hide

- `owner_hidden` is independent of medical review, advertising eligibility and prescription classification. Missing means false for existing products.
- `public_visible` remains the indexed public-query flag. It can be true only for a reviewed, advertising-approved, non-prescription/non-medicine product that is not manually hidden.
- The product list has an immediate show/hide control and an explicit status badge. Drafts cannot be shown from the quick control; the row explains which approval fields to review in Edit.
- Toggle writes only the two visibility fields in a transaction. It does not grant approvals or alter stock/prices.
- Saving an old edit preserves the latest manual hide. XLSX import/update reads current records transactionally, preserves manual hiding, and resets all review/classification/advertising status to private drafts. Export includes `owner_hidden` for reference; import does not map it.
- The storefront filters owner-hidden or ineligible products defensively. Firestore write rules enforce the visibility invariant. Public queries still use the existing `public_visible` index, with no data migration or new index required.
- The order backend checks the live flag and all approval gates. The atomic commit verifies every product's version, preventing a hide or price change between catalog lookup and order commit. Already successful idempotent retries remain recoverable.
- Deployment does not change any products, appearance, order state or customer records. No new service, paid plan, card or billing configuration is involved.

## Checks

- `npm run build`
- `node --experimental-strip-types --test qa/themes.test.mjs qa/orders.test.mjs qa/visibility.test.mjs`
- `qa/node_modules/.bin/firebase emulators:exec --config firebase.themes-testing.json --project demo-theme-check --only firestore 'node --test --test-concurrency=1 qa/rules.test.mjs qa/product-emulator.test.mjs'`
- Start the Vite visual config locally on port 5186, then `node qa/visibility-visual.cjs`. This uses synthetic fixtures and blocks external network requests other than fonts. Screenshots at 320, 390 and 1280 px were inspected for the visibility controls.

Photo upload is not part of this change. Firebase Storage requires Blaze, so it must not be enabled under the store's Spark/no-card constraint.
