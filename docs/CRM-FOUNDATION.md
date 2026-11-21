# One For All Good CRM foundation v4

Source-only foundation integrated behind a disabled gateway. No CRM has been deployed, no real customer capture has occurred, and no archive key has been installed.

## Release decision

Safe to review and consider wiring behind the disabled gateway, not cleared for live activation. The remaining release blocker is measured Workers Free CPU/network performance and a bounded integration of the current notification sweep with the CRM pending-order sweep. Local unit tests cannot prove the Workers 10ms CPU limit. Owner UID migration, infrastructure authorization, privacy review and real end-to-end checks also remain gates.

`crmGateway()` returns no-store 503 before touching auth or storage unless all of these exist:

- `CRM_ENABLED` is exactly `true`.
- `CRM_LIMITS_VERIFIED` is exactly `true`.
- `CRM_OWNER_UID` is pinned to the live verified owner UID.

Do not enable those flags merely to make the demo work. UI owner controls require a matching `VITE_CRM_OWNER_UID` and emailVerified. The rules use `CRM_OWNER_UID_NOT_CONFIGURED` as a deliberate non-working placeholder for the CRM owner, pending deliberate migration. Staff documents must not be provisioned or enabled before that review.

## Storage and privacy

Firestore in the owner's existing `one-for-all-good` project is authoritative for live CRM conversations, customers, tags, assignments and metrics. The Windows POS remains authoritative for inventory and transactions. The proposed local nightly job is a conversation archive only, not a complete or restorable CRM database backup. It exports conversation documents and messages, including conversation-level tags and assignment fields, but does not export the customer collection, order cards, staff accounts/roles, metrics, audit logs or saved replies. It cannot rebuild the full CRM after database loss. Keep that scope explicit in every handoff. Full-database recovery requires a separately reviewed export/restore design; this drop does not provide it. If the POS machine is off, the live inbox still depends on Firebase/Cloudflare, not that PC.

This avoids a third-party CRM subscription. Firebase and Cloudflare are still infrastructure providers, and enabled online AI processes a minimal excerpt. Owning those accounts is not a guarantee that no provider can access conversations. Do not repeat the earlier absolute privacy promise.

## Security changes

### Current authorization, not remembered role

The HTTP layer validates the Firebase ID token, obtains the verified UID and makes a verified-owner claim only for the pinned UID with the expected verified email. It does not infer ownership from email alone.

Every mutation re-reads `staff/{uid}` inside its optimistic atomic unit of work. That current document must be active and have an allowed role. An owner role also requires the pinned verified-owner claim. The staff version and conversation assignment are guarded in the same commit as messages, metrics and audit. A racing revocation conflicts, retries once and is denied.

Customer-card access uses a read-only unit of work with commit-time verify guards. AI verifies current staff/assignment before reading history, rechecks via a guarded audit operation immediately before model disclosure, and checks again before returning the draft. An authorization decision is linearized at the guarded commit; it cannot retroactively recall data already returned or already sent to the model before a later revocation.

Only the owner sees all conversations. Other staff, including admins, read and act only on assigned conversations. The owner assigns from the inbox. Two competing claims on an unassigned conversation cannot both succeed. Presence is advisory, and the owner remains an explicit intervention override.

### Replay keys bind the payload

Staff audit keys bind UID/action/request UUID, and their stored payload hash binds the conversation and canonical JSON payload. Exact retries deduplicate; changed content or another conversation with the same key conflicts with 409. Customer messages similarly store a canonical content hash. Changed-body replays conflict rather than silently discarding the change.

Client pending IDs persist in localStorage as SHA-256-fingerprint-to-UUID records, without message bodies. They survive same-browser reload/restart until success or explicit cleanup. The queue caps at 100 unresolved operations and fails rather than silently generating a new key if storage is corrupt, full or unavailable. The guarantee does not cross browsers, cleared browser storage, private-session destruction or an explicitly discarded operation. Browser access tokens still live in localStorage and require the usual XSS/shared-device precautions.

### Existing store behavior is preserved

The legacy store `isManager()` email check is unchanged. v2 incorrectly added email_verified to all old store permissions; v3 removes that regression. CRM ownership is a separate pinned verified-UID check. When live owner UID/emailVerified are inspected, migrate both deliberately rather than locking the store admin out by accident.

An explicit recursive `pos_tenants` deny is included and must survive the PR15 merge. Emulator tests verify both old store access and the separate CRM pin behavior.

### Shared-browser UI

v4 adds Firestore snapshot error callbacks for role/staff lists, inbox, conversation, messages, presence and saved replies. Denied/error callbacks clear their previous value; conversation/message permission errors also clear the customer, draft, presence and action surface. Inbox filters/user-role changes reset rows and use guarded subscription cleanup. An active owner document is required in the UI even with a matching verified pin, so role revocation cannot fall back to bootstrap controls.

Matching email no longer shows owner controls. Auth changes clear role/staff state; conversation changes clear messages, customer, draft and role-dependent content. Old subscription callbacks are guarded after cleanup, the conversation is keyed to UID plus conversation ID, and late customer-card promises are ignored after cleanup. A synthetic browser test opens an owner conversation, switches to another agent, replays old queued callbacks and asserts the old owner/customer content is absent. Its screenshots are test fixtures, not a real login or live integration.

## Foundation endpoints and data flow

The existing Worker is the intended API host. Import only `crmGateway()` as the entry point for `/crm/*`; dispatch it before the old global Origin rejection, because POS/archive calls have no browser Origin. CRM handlers check their own allowed origin or purpose-specific secret. Keep every existing order/chat/notify/POS path intact when merging.

- `POST /crm/chat`: anonymous saved human chat with a browser-generated session token, conversation UUID and per-message UUID. Phone is never identity. Token hashes alone are stored server-side.
- `POST /crm/chat/read`: token in the body, never URL; numeric sequence cursor, maximum 50 rows, stable message IDs. Notes are removed but still advance the cursor.
- `POST /crm/chat/recover`: order code plus phone proof against tracking and the actual order. It unlocks that order's dedicated conversation only, not every order for a phone. Recovery rotates its token and signs out earlier browser sessions.
- `createCrm(store).linkOrderToCrm(order)`: atomically mirrors persisted order state, customer association, a dedicated conversation, timeline event and nested order card. The hook re-reads the order and clears `crm_pending` after success. Events are retry-safe.
- `POST /crm/events/order`: the POS secret authorizes mirroring only the currently persisted order, not a supplied status mutation.
- `/crm/staff/*`: authenticated reply, note, assignment, status, tags, customer summary, view ledger and AI draft. Message, conversation, metrics and immutable owner-readable ledger commit together. The ready notice requires the order on the assigned conversation and a confirmed/preparing card; the UI asks the staff to confirm readiness. It does not modify POS inventory or sales.
- `POST /crm/archive`: separate read-only archive secret; two bounded modes for conversation-ID pages and numeric message pages. It never returns customer access-token hashes.

The UI is a skeleton, not a full CRM product. It includes login, inbox/status filters, conversation, internal notes, assignment, resolve/reopen, customer summary, ready notice and AI draft. The staff timeline currently shows the latest 100 messages. Saved-reply/tag management, full order-history UI, departments workflow, metrics dashboard, audit viewer, automation runner, snooze UI and history pagination remain Phase 1b. Messenger/Instagram follow via server webhooks. WhatsApp remains later and subject to its existing policy constraints.

## Free online AI

The selected scope is free online staff draft suggestions only; any paid upgrade needs separate approval. The code uses only the existing free Workers AI binding, with no paid-provider path or training/fine-tuning upload.

AI is a staff-reviewed draft in the editor, never auto-sent. It reads at most ten current messages, excludes internal notes and order events, discards common clinical turns, removes common phone/email patterns and caps the excerpt at 1,500 characters. The prompt rejects medical advice, doses and invented commercial facts. Quota/model failure leaves manual replies available.

These filters are minimization, not perfect de-identification. Names, addresses or unusual health wording can evade heuristics. Customer privacy wording, staff guidance and the real-capture review remain activation gates. The guarded audit records AI access, but a model call cannot be atomically rolled back with Firestore.

## Archive transport and local disk controls

`archive/export_crm.py` has one fixed credential-free destination: the existing Worker's HTTPS `/crm/archive` endpoint. Its API validates the exact origin/path, with no username, password, query, fragment, alternate port or trailing-path variation. The CLI accepts only a folder, not an endpoint. Redirects are refused, including 301/302/303/307/308; the Authorization header is never resent to a redirected destination.

Limits: 500 response pages, 1 MiB per response, 50 MiB per archive and a 300-second operation deadline with bounded socket waits. Index pages cap at 20 conversations and message pages at 50. Nonadvancing or invalid cursors abort. No automatic HTTP-error retry can run an unbounded export. A failed/incomplete export never becomes the new completed archive.

A checksum/count manifest is verified before final rename. `last-success.json` is written by temporary-file/fsync/atomic-replace. A proposed seven-completed-archive retention policy runs only after success and validates files before pruning; approve that policy before installing the job. Corrupt/unrecognized files are not silently pruned. The integrity helper and tests detect tampering of a conversation archive. They do not restore Firestore or recreate omitted collections, and are not evidence of full CRM recovery. A full CRM export/restore scope would require separate review.

Do not install a real secret or schedule before checking Windows owner-only ACLs, disk encryption, chosen retention, last-success alerting and a restore drill. This script does not configure or attest Windows security controls. No Drive upload or Windows task exists yet. The export is not a point-in-time snapshot and messages arriving late can require the next daily pass.

## Request budget and remaining free-tier blocker

`worker/lib/atomic.js` caps conflicts at two attempts. Read-only authorization also verifies read versions. `worker/lib/budget.js` counts network attempts and enforces a 20-attempt/10-second CRM request budget in the gateway. OAuth, Firestore, identity lookup and model calls consume that budget; network requests have bounded timeouts. Contention or overload returns a no-store 503, retaining the request UUID for retry. These protections are not evidence that Workers CPU fits its free allowance.

The existing notification loop and CRM outbox producer/scheduler have not been merged. Required before activation:

1. Persist `crm_pending:true` with every relevant order lifecycle write, alongside the existing notification work.
2. Give a single scheduler a shared I/O budget across notification and CRM operations. Do not append a separate ten-order CRM loop to the current notification sweep.
3. Limit the integration to one selected CRM pending order per scheduled pass initially, only when budget remains, and leave other work pending. Measure full cold/warm and contested executions, including service-token signing, existing notifications and retries. Do not infer a 50-subrequest pass from unit-call counts.
4. Measure actual Workers CPU/duration/subrequest behavior with isolated test traffic and no live customer capture. Set `CRM_LIMITS_VERIFIED` only after those results and overload/replay tests pass.
5. Create reviewed composite indexes for status/assignee/last_message_at queries, verify the chosen owner UID/rules migration and restore infrastructure auth.

Current official references, checked during the preceding revision: Firestore free 1 GiB/50k reads/20k writes per day at https://firebase.google.com/docs/firestore/quotas ; Workers Free 100k requests/day and 50 external subrequests at https://developers.cloudflare.com/workers/platform/limits/ ; AI 10k free neurons/day at https://developers.cloudflare.com/workers-ai/platform/pricing/ ; multiple Hosting sites at https://firebase.google.com/docs/hosting/multisites . Budgets are shared with store/POS. Polling every 15 seconds is 240 requests per open customer-hour; stop when closed and measure actual read use. Do not enable Blaze/Workers Paid or claim unlimited capacity/uptime.

## Delivery and validation

The second Hosting site is only proposed as `one-for-all-good-crm`, not created or delivered. Explicitly create a site before mapping a Hosting target; target:apply does not create sites. Finish StoreChat's separate saved-human-chat UI using the provided client module and truthful privacy text. Do not mix the existing ephemeral AI mode with saved human chat silently.

Checks run for v3:

- 32 Node tests pass: original review regressions plus commit-race revocation, read-only revocation, pre-AI revocation, payload conflicts, persistent retries, pinned UI owner, stale callback cleanup, default-off gateway and bounded contention/network behavior.
- 8 Firestore emulator/real REST-adapter tests pass, including unchanged unverified legacy store manager behavior, pinned CRM owner and explicit POS deny.
- 8 Python archive tests pass, including destination binding before authorization, redirect refusal, response/page/time bounds, multi-page export, checksum integrity, failure preservation, atomic last-success and retention.
- Frozen pnpm install and TypeScript/production build pass. The build still reports a large JS bundle, so performance is not signed off. The prior production dependency audit was clean; test-only tooling has older transitive dependencies and is never deployed.
- Synthetic browser switch-user regression passes. Before/after mobile screenshots were inspected: old content is gone for the other agent. No real staff auth or live end-to-end order test has happened.

Run `npm test` from root. Build with `pnpm --dir crm install --frozen-lockfile && pnpm --dir crm build`. For rules: install isolated test tools with `cd testing && npm ci`, then from root run `testing/node_modules/.bin/firebase emulators:exec --config firebase.testing.json --project demo-crm-check --only firestore 'node --test testing/rules.test.mjs'`. Run Python tests from archive/ with `python3 -m unittest test_export_crm.py`. The v4 browser revocation regression additionally terminates conversation/message listeners with permission-denied, clears existing inbox rows after a query error, and revokes the owner role without an auth switch. It asserts that old customer/draft/action content disappears and an access notice replaces it. The browser regression uses the test-only Vite config and synthetic fixture module, never the production build. Keep the gateway disabled while any gate above remains unresolved.
