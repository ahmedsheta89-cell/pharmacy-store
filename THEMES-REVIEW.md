# Storefront themes review

Live rollout approved by the owner on 22 November 2026. Hosting, rules and Worker deployed. No production appearance-document write made; legacy green/white remains initial fallback.

## Behavior

- Six canonical design presets plus Ramadan, Eid al-Fitr and Eid al-Adha share storefront components and semantic CSS variables. The existing legacy green/white look is preserved as the source default; Royal Amethyst remains available. Admin remains neutral.
- Owner appearance controls persist one exact-schema `store_public/appearance` document. Public single-document get only; no public list/write. Existing legacy manager rule is unchanged.
- Date windows use Cairo calendar dates with inclusive endpoints, no overlap, no yearly recurrence. Automatic mode starts OFF and dates are blank. Dates must be reviewed, not guessed from fixed Gregorian dates.
- Manual preset selection can choose any of the nine. Automatic mode overrides within enabled reviewed windows and restores manual selection outside them. Active browser pages check their Cairo day every 30 seconds and on focus/visibility. This is cosmetic scheduling, not a server scheduler. It depends on the device clock.
- Closed-state message is limited to 240 characters. New checkout is blocked in UI and Worker. Worker read failures fail closed. Its atomic commit verifies the appearance-document version so a racing closure rejects an order. A previously successful retry remains recoverable, without a duplicate.
- Missing appearance document preserves legacy open-store behavior with an exists:false commit guard. Malformed seasonal data falls back to manual appearance. Rules validate date shape/order/overlap; client additionally validates actual calendar dates.
- URL `?previewTheme=<id>` is local-only, visibly labelled and never writes settings. It DOES NOT create a test-mode checkout. Do not place fake orders on production using that parameter.

## Review fixtures

`vite.visual.config.ts` serves port 5186 with `qa/firebase-fixture.js`. Synthetic nonmedical products and a banner are explicitly marked as previews. Firebase reads and writes are overridden; all unused mutations throw. Playwright also blocks external network except font hosts. Never deploy this config or fixture.

The private visual-review gallery is image-only, not a working staging store: https://files.instinct.com/p7987esfxw8h
It includes desktop/mobile screenshots for all nine and admin/checkout/chat. No real inventory or medical advertising is represented. Customer accounts are not implemented.

## Reproduce QA

With app dependencies installed and isolated QA dependencies from `qa/package-lock.json`:

```
node --experimental-strip-types --test qa/themes.test.mjs qa/orders.test.mjs
./qa/node_modules/.bin/firebase emulators:exec --only firestore --project demo-theme-check --config firebase.themes-testing.json 'node --test qa/rules.test.mjs'
npm run build
# In separate terminals, synthetic visual run:
./node_modules/.bin/vite --config vite.visual.config.ts --host 127.0.0.1 --port 5186
node qa/visual.cjs
```

18 pure/backend/emulator tests passed. Visual checks cover nine presets at 320/390/1280/1440 widths, no horizontal overflow, admin save, cross-tab updates, closed product/checkout. Browser errors empty. Worker dry-run: 27.33 KiB / 7.67 KiB gzip.

## Rollout checks

Owner approved live rollout via WhatsApp voice note at 05:04 Cairo. Firebase Spark and Workers Free verified before deployment. POS/CRM excluded. Live authenticated admin and all ten view URLs verified without fake orders or appearance writes. Persistence/closure semantics passed emulator and synthetic cross-tab tests; no global closure was applied to production just for QA. Do not enable automatic dates without reviewed windows. Never enable paid hosting, Blaze, billing or a card.

Existing main JavaScript and Excel import chunks remain above Vite's 500KB warning threshold. Code splitting is a separate optimization, not hidden by this change.
