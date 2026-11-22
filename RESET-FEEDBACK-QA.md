# Password-reset feedback fix, review candidate

The verification below was completed before release. This fix was deployed through PR #20 on November 22, 2026 and is retained in the photo release.

## Change

The login page no longer says a reset email was sent merely because Firebase accepted the request. With email-enumeration protection, acceptance is also returned for an address with no account. The new message is conditional and explicitly separates request acceptance from sending or delivery.

Reset throttling, network failure and invalid email syntax have separate messages. Unknown errors do not echo server messages or reveal account existence. Login, account data, credentials and password-reset mechanics are unchanged.

## Verification

- Production build passes.
- 24 unit/regression tests pass across reset feedback, orders, themes and product visibility.
- Actual Admin component and production Firebase SDK run in Playwright with synthetic configuration and intercepted Auth transport. No real account/reset endpoint is reachable from the test.
- Covered empty email, accepted unknown-account response, rate limiting, network failure, invalid-email response, stale success removal and busy controls.
- Verified the password reaches the synthetic sign-in request byte-for-byte, including leading/trailing spaces, Arabic digits and punctuation.
- Checked 320, 390 and 1280 pixel widths for horizontal overflow. Inspected the 320/1280 conditional-feedback screenshots and the 390-pixel throttling screenshot. Text and controls remain visible.

Run:

```sh
npm run build
node --test qa/password-reset-feedback.test.mjs qa/orders.test.mjs qa/themes.test.mjs qa/visibility.test.mjs
node qa/auth-feedback-visual.cjs
```

The browser test expects Google Chrome at `/opt/google/chrome/chrome` and Playwright in the QA dependencies. It uses only a local Vite server and intercepted synthetic Auth responses.

## Release limits

This fixes feedback only. It does not prove delivery of any particular email, change Firebase quotas, add logging, change a password or resolve address aliases. The original reset-only patch included no photo or publication-workflow changes. Later photo work retains this feedback behavior.
