# Private POS enrollment and atomic CATALOG_DRAFT application

Proposed server enrollment model for this first single-tenant pilot. Not deployed or enrolled. The exact verified Firebase UID must be obtained from a freshly verified ID token/account record. Do not fill a UID from an email, a local username or the desktop-supplied body.

## Namespace / trust boundary

Firebase project: one-for-all-good (the existing store project).
Server-owned tenant ID: one-for-all-good. The current request does not carry a tenant field; the gateway supplies it. Branch ID in this first pilot: main.

Private server-only documents:

```
pos_tenants/{tenantId}
pos_tenants/{tenantId}/members/{firebaseUid}
pos_tenants/{tenantId}/branches/{branchId}
pos_tenants/{tenantId}/devices/{deviceId}
pos_tenants/{tenantId}/devices/{deviceId}/operations/{operationId}
```

Deny client direct read/write of these namespaces in Firestore Rules initially. Service-identity gateway access uses IAM and bypasses Rules, so every route still enforces membership, device state and operation capability. Never put enrollment data under the public products collection.

### Tenant doc shape

```json
{"enabled":true,"firebaseProject":"one-for-all-good","schemaVersion":1}
```

### Member doc shape

The document ID is the actual Firebase UID, not an email.

```json
{
  "enabled":true,
  "role":"owner",
  "branches":["main"],
  "capabilities":["catalog.draft.write"],
  "allowedKinds":["CATALOG_DRAFT"],
  "enrolledAtUtc":"server timestamp",
  "enrolledByUid":"verified owner UID"
}
```

### Branch doc shape

```json
{"enabled":true,"label":"Main branch","timezone":"Africa/Cairo"}
```

### Device doc shape

Device IDs are locally generated 32-character lowercase GUID hex strings. They identify an enrollment, not a secret or authentication factor.

```json
{
  "enabled":false,
  "branchId":"main",
  "ownerUid":"verified Firebase UID",
  "allowedUids":["verified Firebase UID"],
  "capabilities":["catalog.draft.write"],
  "allowedKinds":["CATALOG_DRAFT"],
  "label":"owner-confirmed Windows PC label",
  "createdAtUtc":"server timestamp",
  "approvedAtUtc":null,
  "approvedByUid":null,
  "revokedAtUtc":null
}
```

Default enrollment is disabled. Enabling requires a deliberate owner-approved enrollment step that identifies the device ID on the desktop and the corresponding pending record. A sender-controlled Device value, a successful Firebase login or possession of the manager email does not self-enroll a device. Do not silently create an enabled device during /pos/sync. No approval for a particular real device is implied by these example shapes.

For a first owner-only pilot, require verified token UID == member document ID == device.ownerUid, and UID in allowedUids, branch in member.branches, branch == device.branchId, all enabled states true, no revocation, and capability catalog.draft.write plus allowedKind CATALOG_DRAFT on both member/device. Read current documents, not indefinitely cached approvals. Later multi-staff/branch roles need their own scoped enrollment workflow, not automatic widening.

## Atomic deduplication record

Document ID: operation Id within the specific tenant/device operations collection. Record fields:

```json
{
  "payloadHash":"uppercase SHA256 of exact Kind + newline + exact Payload string",
  "kind":"CATALOG_DRAFT",
  "branchId":"main",
  "userUid":"verified Firebase UID",
  "storeProductId":"explicit mapped store ID",
  "appliedAtUtc":"server timestamp",
  "result":"APPLIED"
}
```

An existing same-operation/same-hash record is a safe replay ACK, even if its expectedCloudVersion is now stale because the original update succeeded. Existing same-operation/different-hash is a hard conflict, never a replay success. Scope record lookup by server tenant/device, not a global client ID. No operation is acknowledged before commit.

## CATALOG_DRAFT transaction

1. Authenticate token against the correct Firebase project. Authorize current tenant/member/branch/device/capability, even for replay.
2. Enforce bounded JSON/body/field sizes, 32-hex device ID, recognized operation kind, payload hash, exact schema and draft.id == storeId. The expectedCloudVersion must come from an authenticated Firestore document read's updateTime, not clinical content_version.
3. In a Firestore transaction, read the scoped dedup record and current products/{storeId}. Apply the replay rule first. For a new operation, require existing product and matching updateTime. Do not create a product merely because an arbitrary ID was sent.
4. Apply an explicit field patch using the draft fields below. Create the operation/dedup record atomically in the same transaction. No stock/sales/HR write occurs.
5. Return the matching Id/hash ACK only after success. If comparison fails, return Accepted=false with a conflict code. Lost responses are retried safely against dedup.

Explicit patch fields:

```
name, price, unit, imageUrl, description,
dosage_information, usage_instructions, warnings, content_source,
content_reviewer, content_reviewed_at, content_version,
content_review_status, prescription_status, advertising_status, public_visible
```

The last seven publication/provenance fields must be reset to the private/unreviewed constants from the schema, not trusted from arbitrary client input. If applying to a previously published product, the result becomes private until separately reviewed in the store. That is intentional and must be clearly presented before the owner queues a draft.

Preserve existing nameEn, category, oldPrice, badge, import_source, stock_quantity and any unrelated fields. The draft adapter currently has blank/default nameEn/category placeholders; do NOT copy them over existing cloud values. stock_quantity=null means no update, not delete/zero. No local image path, purchase cost, employee data or raw private profile JSON is in this patch.

Use a proper Firestore transaction or equivalent atomic compare-and-write. A read/check followed by unguarded set is unsafe. Ensure read membership/branch/device state is part of the authorized write decision. The final deployed implementation needs tests for revoke racing with commit as well as price/profile concurrent changes.

## Activation still pending

The enrollment docs do not exist by virtue of this file. No real device UID/link has been approved, no gateway endpoint is configured and no ID token provider exists in the desktop UI yet. Build/test on synthetic staging records first. Keep the route default-deny until enrollment, membership, transaction/replay and cloud conflict checks pass.
