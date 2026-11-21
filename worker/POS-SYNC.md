# POS sync gateway pilot, disabled

This increment implements `/pos/sync` in source only. `POS_SYNC_ENABLED` defaults to
`false`; absent flag, limiter, authentication or enrollment all fail closed. No
real device is enrolled and this is not live inventory sync.

## Wire and pilot ceilings

The PascalCase `pharmacy-sync-v1` envelope and ACK match the POS contract. Hash is
uppercase SHA256 of `Kind + "\n" + exact Payload`, before JSON parsing. Pilot limits
are 5 operations, 64 KiB UTF-8 per payload and 256 KiB body. Desktop must use the
same ceilings. Limiting applies to IP and verified UID. No browser Origin is
required on this route. Other website routes keep their existing Origin gate.

Only `CATALOG_DRAFT` is implemented. Unknown kinds receive explicit
`unsupported_kind`, never an applied ACK. A transient infrastructure error returns
503 with no ACKs, including if an earlier operation committed. Retry is safe via
the ledger. Incorrect hash and permanent validation/version conflicts return
negative ACKs for manual review, not blind retry.

## Authentication and enrollment

Firebase ID token RS256 signature is verified against Google's certificate set,
with pinned algorithm, project audience, issuer, subject and expiry/issued/auth
claims. A current Firebase account lookup also checks disabled/revoked state.
Certificates follow cache-control up to one hour. Token requests never follow
redirects. Service credentials stay server-only. Native device IDs are identifiers,
not authentication factors.

Private namespaces are under `pos_tenants/one-for-all-good`. Tenant, current member,
branch and device must all be enabled. Pilot is owner-only, branch `main`. Device
owner UID must equal verified UID, UID must be allowed, branch must match, no
revocation, and **both member and device** require:

```
capabilities: ["catalog.draft.write"]
allowedKinds: ["CATALOG_DRAFT"]
```

The member `allowedKinds` field is an intentional addition to the first enrollment
example, agreed with the POS team. Missing fields deny access. No route creates or
enables membership/device documents. Firestore rules explicitly deny client access
to all POS namespaces, managers included.

## Atomic behavior

Each operation uses a read-write Firestore transaction. The transaction reads all
four current authorization documents, scoped operation ledger and mapped existing
product. New operations require the exact Firestore `updateTime` supplied as
`expectedCloudVersion`. A field-mask patch and a create-only dedup/audit record with
server timestamp are committed together. Concurrent product changes or enrollment
revocation invalidate the transaction. No automatic retry overwrites a conflict.

Ledger is scoped by server tenant/device/operation and also records branch/UID/kind.
Same ID/hash replay ACKs safely before the stale product-version check. Different
hash is `operation_conflict`. Replays still require current membership.

Only name, price, unit, HTTPS image URL, description and clinical content/source
are patched. Reviewer/date/version are cleared, content/ad review becomes
unreviewed, prescription status unknown and visibility false. Existing category,
English name, stock, import provenance and other fields are preserved. Empty
category/English and null stock from POS are sentinels, not cloud updates.
Neither product creation nor sale/purchase/HR/order writes are implemented.

## Verification completed

- Node unit/model tests cover parsing/hash, authorization, payload preservation,
  replay/conflict, missing/versioned product, before/after-commit failures,
  transaction-model concurrent update/revocation and body/rate caps.
- Auth tests use a temporary synthetic RSA certificate/key and real JWT signature
  verification, with wrong-project/issuer/time/signature/account checks.
- Worker dry-run bundle succeeds without credentials; storefront build succeeds.

These are local unit/model tests, **not proof of actual Firestore contention or
free Worker CPU performance**. No production route, rules or data were changed by
local testing. No visual UI is included in this increment.

## Activation gates still open

1. Review this source and coordinated desktop ceilings/member schema.
2. Obtain owner-approved device ID, real freshly verified UID and branch, then
   explicitly enroll. Never derive UID from email or auto-enable a device.
3. Test against synthetic emulator/staging documents and the real REST transaction
   adapter, including revocation racing commit and response loss.
4. Profile CPU/subrequests/quota on the free Worker. Five operations bound normal
   Firestore calls (one initial membership batch plus begin/read/commit per op),
   but actual10ms CPU must be measured. STOP before any paid component/card/Blaze.
5. Deploy rules and disabled Worker through an authorized official connection,
   verify default-deny live, inspect membership readback, and separately approve
   activation. No saved deployment OAuth tokens remain from earlier QA.
6. Add authenticated catalog pull/version cursor and Windows token-provider UI;
   do end-to-end draft-only sync and delete synthetic QA documents.

Sources checked for implementation:
- https://firebase.google.com/docs/auth/admin/verify-id-tokens
- https://firebase.google.com/docs/firestore/reference/rest/v1/projects.databases.documents/beginTransaction
- https://firebase.google.com/docs/firestore/reference/rest/v1/projects.databases.documents/batchGet
- https://firebase.google.com/docs/firestore/reference/rest/v1/projects.databases.documents/commit
